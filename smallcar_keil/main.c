#include "stm32f10x.h"
#include "motor.h"
#include "ps2.h"
#include "servo.h"
#include "remote.h"
#include "battery.h"
#include <stdlib.h>

#define PS2_DEBUG_TEST        0
#define YAW_MIN_ANGLE         15U
#define YAW_MAX_ANGLE         165U
#define PITCH_MIN_ANGLE       15U
#define PITCH_MAX_ANGLE       150U
#define SERVO_STEP_ANGLE      2U
#define UART_RX_BUF_SIZE      64U
#define REMOTE_TIMEOUT_LOOPS  50U

static volatile char uart_rx_buf[UART_RX_BUF_SIZE];
static volatile uint8_t uart_rx_pos = 0U;
static volatile RemoteCmd_t g_remote_cmd = {0};
static volatile uint32_t g_loop_counter = 0U;

static void delay_ms(uint32_t ms)
{
    uint32_t i;
    uint32_t j;
    /* 粗略延时，假设系统时钟约 72MHz */
    for (i = 0; i < ms; i++)
    {
        for (j = 0; j < 8000; j++)
        {
            __NOP();
        }
    }
}

static void USART1_SendChar(char c)
{
    while ((USART1->SR & USART_SR_TXE) == 0U)
    {
    }
    USART1->DR = (uint16_t)c;
}

static void USART1_SendString(const char *s)
{
    while (*s != '\0')
    {
        USART1_SendChar(*s++);
    }
}

static void USART1_SendUInt(uint32_t v)
{
    char buf[11];
    int pos = 0;

    if (v == 0U)
    {
        USART1_SendChar('0');
        return;
    }

    while (v > 0U && pos < 10)
    {
        buf[pos++] = (char)('0' + (v % 10U));
        v /= 10U;
    }

    while (pos > 0)
    {
        pos--;
        USART1_SendChar(buf[pos]);
    }
}

static void USART1_Init(void)
{
    /* GPIOA 和 USART1 时钟使能 */
    RCC->APB2ENR |= RCC_APB2ENR_IOPAEN | RCC_APB2ENR_USART1EN;

    /* PA9: TX (AF 推挽 50MHz)，PA10: RX (浮空输入) */
    GPIOA->CRH &= ~((uint32_t)(GPIO_CRH_MODE9 | GPIO_CRH_CNF9 |
                               GPIO_CRH_MODE10 | GPIO_CRH_CNF10));
    GPIOA->CRH |= (GPIO_CRH_MODE9_0 | GPIO_CRH_MODE9_1);
    GPIOA->CRH |= GPIO_CRH_CNF9_1;
    GPIOA->CRH |= GPIO_CRH_CNF10_0;

    /* 波特率 115200 @72MHz：BRR = 0x0271 */
    USART1->BRR = 0x0271U;
    USART1->CR1 = USART_CR1_TE | USART_CR1_RE | USART_CR1_RXNEIE | USART_CR1_UE;

    NVIC_EnableIRQ(USART1_IRQn);
}

void USART1_IRQHandler(void)
{
    if ((USART1->SR & USART_SR_RXNE) != 0U)
    {
        char c = (char)USART1->DR;

        if (c == '\n' || c == '\r')
        {
            if (uart_rx_pos > 0U)
            {
                if (uart_rx_pos >= UART_RX_BUF_SIZE)
                {
                    uart_rx_pos = 0U;
                }
                uart_rx_buf[uart_rx_pos] = '\0';
                Remote_ParseLine((char *)uart_rx_buf, &g_remote_cmd, g_loop_counter);
                uart_rx_pos = 0U;
            }
        }
        else
        {
            if (uart_rx_pos < (UART_RX_BUF_SIZE - 1U))
            {
                uart_rx_buf[uart_rx_pos++] = c;
            }
            else
            {
                uart_rx_pos = 0U;
            }
        }
    }
}

int main(void)
{
    uint8_t lx;
    uint8_t rx;
    uint8_t ry;
    int16_t left_cmd;
    int16_t right_cmd;
    int16_t k_turn = 70; /* 转向系数，百分比 */
    int16_t speed_percent = 80; /* 速度挡位：默认 50% */
    uint8_t speed_level = 1U;
    uint8_t select_prev = 0U;
    uint8_t select_now = 0U;
    uint16_t yaw_angle = 90U;
    uint16_t pitch_angle = 90U;

    /* 系统时钟在启动文件和 system_stm32f10x.c 中已配置为 72MHz */

    Motor_Init();
    PS2_Init();
    Servo_Init();
    USART1_Init();
    Battery_ADC_Init();
    Remote_Reset(&g_remote_cmd);

    while (1)
    {
        g_loop_counter++;
 #if PS2_DEBUG_TEST
        ps2_key_serch();
        lx = ps2_get_anolog_data(PSS_LX);
        ly = ps2_get_anolog_data(PSS_LY);
        rx = ps2_get_anolog_data(PSS_RX);
        ry = ps2_get_anolog_data(PSS_RY);
        delay_ms(50U);
#else
        /* 扫描按键/摇杆数据 */
        ps2_key_serch();

        if (Data[1] == 0x73U)
        {
            lx = ps2_get_anolog_data(PSS_LX);
            rx = ps2_get_anolog_data(PSS_RX);
            ry = ps2_get_anolog_data(PSS_RY);
        }
        else
        {
            lx = 0x80U;
            rx = 0x80U;
            ry = 0x80U;
        }

        /* 1. 云台控制：右侧彩色键 + （模拟模式下）右摇杆，R2 一键回中
         * 当前方向：方块=Yaw 右，圆圈=Yaw 左，三角=Pitch 下，叉号=Pitch 上 */
        if (ps2_get_key_state(PSB_PINK))
        {
            /* 方块：Yaw 向右 */
            if (yaw_angle + SERVO_STEP_ANGLE < YAW_MAX_ANGLE)
            {
                yaw_angle += SERVO_STEP_ANGLE;
            }
            else
            {
                yaw_angle = YAW_MAX_ANGLE;
            }
        }
        if (ps2_get_key_state(PSB_RED))
        {
            /* 圆圈：Yaw 向左 */
            if (yaw_angle > YAW_MIN_ANGLE + SERVO_STEP_ANGLE)
            {
                yaw_angle -= SERVO_STEP_ANGLE;
            }
            else
            {
                yaw_angle = YAW_MIN_ANGLE;
            }
        }
        if (ps2_get_key_state(PSB_GREEN))
        {
            /* 三角：Pitch 向下 */
            if (pitch_angle > PITCH_MIN_ANGLE + SERVO_STEP_ANGLE)
            {
                pitch_angle -= SERVO_STEP_ANGLE;
            }
            else
            {
                pitch_angle = PITCH_MIN_ANGLE;
            }
        }
        if (ps2_get_key_state(PSB_BLUE))
        {
            /* 叉号：Pitch 向上 */
            if (pitch_angle + SERVO_STEP_ANGLE < PITCH_MAX_ANGLE)
            {
                pitch_angle += SERVO_STEP_ANGLE;
            }
            else
            {
                pitch_angle = PITCH_MAX_ANGLE;
            }
        }

        if (Data[1] == 0x73U)
        {
            /* 右摇杆左右控制 Yaw */
            if (rx < 0x70U)
            {
                /* RX 小于 0x70：Yaw 向右 */
                if (yaw_angle + SERVO_STEP_ANGLE < YAW_MAX_ANGLE)
                {
                    yaw_angle += SERVO_STEP_ANGLE;
                }
                else
                {
                    yaw_angle = YAW_MAX_ANGLE;
                }
            }
            else if (rx > 0x90U)
            {
                /* RX 大于 0x90：Yaw 向左 */
                if (yaw_angle > YAW_MIN_ANGLE + SERVO_STEP_ANGLE)
                {
                    yaw_angle -= SERVO_STEP_ANGLE;
                }
                else
                {
                    yaw_angle = YAW_MIN_ANGLE;
                }
            }

            /* 右摇杆上下控制 Pitch */
            if (ry < 0x70U)
            {
                /* RY 小于 0x70：Pitch 向下（低头） */
                if (pitch_angle > PITCH_MIN_ANGLE + SERVO_STEP_ANGLE)
                {
                    pitch_angle -= SERVO_STEP_ANGLE;
                }
                else
                {
                    pitch_angle = PITCH_MIN_ANGLE;
                }
            }
            else if (ry > 0x90U)
            {
                /* RY 大于 0x90：Pitch 向上（抬头） */
                if (pitch_angle + SERVO_STEP_ANGLE < PITCH_MAX_ANGLE)
                {
                    pitch_angle += SERVO_STEP_ANGLE;
                }
                else
                {
                    pitch_angle = PITCH_MAX_ANGLE;
                }
            }
        }

        if (ps2_get_key_state(PSB_START) ||
            (Data[1] == 0x73U && ps2_get_key_state(PSB_R3)))
        {
            yaw_angle = 90U;
            pitch_angle = 90U;
        }

        Servo_SetYawAngle(yaw_angle);
        Servo_SetPitchAngle(pitch_angle);

        /* 挡位设置：SELECT 三挡循环（60/80/100） */
        select_now = ps2_get_key_state(PSB_SELECT);
        if (select_now && !select_prev)
        {
            if (speed_level >= 2U)
            {
                speed_level = 0U;
            }
            else
            {
                speed_level++;
            }

            if (speed_level == 0U)
            {
                speed_percent = 60;
            }
            else if (speed_level == 1U)
            {
                speed_percent = 80;
            }
            else
            {
                speed_percent = 100;
            }
        }
        select_prev = select_now;

        /* 2. 小车控制：R1/R2 控制前进后退，左右按键/左摇杆左右差速转弯，L1/L2 原地转 */
        {
            uint8_t l1 = ps2_get_key_state(PSB_L1);
            uint8_t l2 = ps2_get_key_state(PSB_L2);
            uint8_t r1 = ps2_get_key_state(PSB_R1);
            uint8_t r2 = ps2_get_key_state(PSB_R2);
            uint8_t left = ps2_get_key_state(PSB_PAD_LEFT);
            uint8_t right = ps2_get_key_state(PSB_PAD_RIGHT);
            int16_t base;
            int16_t steer = 0;
            int16_t delta;
            int16_t max_delta;

            /* 2.1 L1/L2 原地转优先 */
            if (l1 && !l2)
            {
                base = speed_percent;
                Motor_SetLR((int16_t)-base, base);
            }
            else if (l2 && !l1)
            {
                base = speed_percent;
                Motor_SetLR(base, (int16_t)-base);
            }
            else
            {
                /* 2.2 R1/R2 控制前进/后退 */
                if (r1 && !r2)
                {
                    base = speed_percent;
                }
                else if (r2 && !r1)
                {
                    base = (int16_t)-speed_percent;
                }
                else
                {
                    base = 0;
                }

                if (base == 0)
                {
                    Motor_SetLR(0, 0);
                }
                else
                {
                    /* 2.3 左右按键/左摇杆左右做差速转弯 */
                    if (left && !right)
                    {
                        steer = -100;
                    }
                    else if (right && !left)
                    {
                        steer = 100;
                    }
                    else
                    {
                        if (Data[1] == 0x73U)
                        {
                            int16_t ax;

                            ax = (int16_t)lx - 0x80;
                            if (ax > 20 || ax < -20)
                            {
                                steer = (int16_t)((int32_t)ax * 100 / 128);
                            }
                        }
                    }

                    if (steer == 0)
                    {
                        Motor_SetLR(base, base);
                    }
                    else
                    {
                        delta = (int16_t)((int32_t)k_turn * steer / 100);
                        max_delta = (base >= 0) ? base : (int16_t)(-base);
                        if (delta > max_delta)
                        {
                            delta = max_delta;
                        }
                        else if (delta < -max_delta)
                        {
                            delta = -max_delta;
                        }

                        left_cmd  = base + delta;
                        right_cmd = base - delta;

                        if (left_cmd > 100)
                        {
                            left_cmd = 100;
                        }
                        else if (left_cmd < -100)
                        {
                            left_cmd = -100;
                        }

                        if (right_cmd > 100)
                        {
                            right_cmd = 100;
                        }
                        else if (right_cmd < -100)
                        {
                            right_cmd = -100;
                        }

                        Motor_SetLR(left_cmd, right_cmd);
                    }
                }
            }
        }

        /* 3. 串口远程控制：如有最近的远程指令，则覆盖上述 PS2 控制 */
        {
            RemoteCmd_t rc;
            uint8_t use_remote = 0U;
            uint32_t age;

            rc = g_remote_cmd;
            if (rc.valid)
            {
                age = g_loop_counter - rc.last_tick;
                if (age <= REMOTE_TIMEOUT_LOOPS)
                {
                    use_remote = 1U;
                }
            }

            if (use_remote)
            {
                int16_t base;
                int16_t steer_remote = rc.steer;
                int16_t delta_remote;
                int16_t max_delta_remote;

                base = (int16_t)((int32_t)rc.throttle * speed_percent / 100);

                if (base == 0 && steer_remote != 0)
                {
                    /* 串口遥控：throttle = 0 且 steer != 0 时，做原地左/右转 */
                    int16_t spin = speed_percent;
                    if (spin > 100)
                    {
                        spin = 100;
                    }

                    if (steer_remote < 0)
                    {
                        /* steer < 0：原地左转 */
                        Motor_SetLR((int16_t)-spin, spin);
                    }
                    else
                    {
                        /* steer > 0：原地右转 */
                        Motor_SetLR(spin, (int16_t)-spin);
                    }
                }
                else if (base == 0 && steer_remote == 0)
                {
                    Motor_SetLR(0, 0);
                }
                else
                {
                    delta_remote = (int16_t)((int32_t)k_turn * steer_remote / 100);
                    max_delta_remote = (base >= 0) ? base : (int16_t)(-base);

                    if (delta_remote > max_delta_remote)
                    {
                        delta_remote = max_delta_remote;
                    }
                    else if (delta_remote < -max_delta_remote)
                    {
                        delta_remote = -max_delta_remote;
                    }

                    left_cmd  = base + delta_remote;
                    right_cmd = base - delta_remote;

                    if (left_cmd > 100)
                    {
                        left_cmd = 100;
                    }
                    else if (left_cmd < -100)
                    {
                        left_cmd = -100;
                    }

                    if (right_cmd > 100)
                    {
                        right_cmd = 100;
                    }
                    else if (right_cmd < -100)
                    {
                        right_cmd = -100;
                    }

                    Motor_SetLR(left_cmd, right_cmd);
                }

                if (rc.yaw >= 0)
                {
                    int16_t y = rc.yaw;
                    if (y < (int16_t)YAW_MIN_ANGLE)
                    {
                        y = (int16_t)YAW_MIN_ANGLE;
                    }
                    if (y > (int16_t)YAW_MAX_ANGLE)
                    {
                        y = (int16_t)YAW_MAX_ANGLE;
                    }
                    yaw_angle = (uint16_t)y;
                }

                if (rc.pitch >= 0)
                {
                    int16_t p = rc.pitch;
                    if (p < (int16_t)PITCH_MIN_ANGLE)
                    {
                        p = (int16_t)PITCH_MIN_ANGLE;
                    }
                    if (p > (int16_t)PITCH_MAX_ANGLE)
                    {
                        p = (int16_t)PITCH_MAX_ANGLE;
                    }
                    pitch_angle = (uint16_t)p;
                }

                Servo_SetYawAngle(yaw_angle);
                Servo_SetPitchAngle(pitch_angle);
            }
        }

        if ((g_loop_counter % 50U) == 0U)
        {
            uint32_t vbat_mv;
            uint8_t soc;

            vbat_mv = Battery_GetVoltage_mV();
            soc = Battery_ConvertPercent(vbat_mv);

            USART1_SendString("B,");
            USART1_SendUInt(vbat_mv);
            USART1_SendString(",");
            USART1_SendUInt((uint32_t)soc);
            USART1_SendString("\r\n");
        }

        /* 简单节流，避免查询过快 */
        delay_ms(20);
#endif
    }
}
