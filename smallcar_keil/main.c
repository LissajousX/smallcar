#include "stm32f10x.h"
#include "motor.h"
#include "ps2.h"
#include "servo.h"

#define PS2_DEBUG_TEST     0
#define YAW_MIN_ANGLE      30U
#define YAW_MAX_ANGLE      150U
#define PITCH_MIN_ANGLE    45U
#define PITCH_MAX_ANGLE    135U
#define SERVO_STEP_ANGLE   2U

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

    while (1)
    {
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

        /* 1. 云台控制：右侧彩色键 + （模拟模式下）右摇杆，R2 一键回中 */
        if (ps2_get_key_state(PSB_PINK))
        {
            if (yaw_angle > YAW_MIN_ANGLE + SERVO_STEP_ANGLE)
            {
                yaw_angle -= SERVO_STEP_ANGLE;
            }
            else
            {
                yaw_angle = YAW_MIN_ANGLE;
            }
        }
        if (ps2_get_key_state(PSB_RED))
        {
            if (yaw_angle + SERVO_STEP_ANGLE < YAW_MAX_ANGLE)
            {
                yaw_angle += SERVO_STEP_ANGLE;
            }
            else
            {
                yaw_angle = YAW_MAX_ANGLE;
            }
        }
        if (ps2_get_key_state(PSB_GREEN))
        {
            if (pitch_angle + SERVO_STEP_ANGLE < PITCH_MAX_ANGLE)
            {
                pitch_angle += SERVO_STEP_ANGLE;
            }
            else
            {
                pitch_angle = PITCH_MAX_ANGLE;
            }
        }
        if (ps2_get_key_state(PSB_BLUE))
        {
            if (pitch_angle > PITCH_MIN_ANGLE + SERVO_STEP_ANGLE)
            {
                pitch_angle -= SERVO_STEP_ANGLE;
            }
            else
            {
                pitch_angle = PITCH_MIN_ANGLE;
            }
        }

        if (Data[1] == 0x73U)
        {
            if (rx < 0x70U)
            {
                if (yaw_angle > YAW_MIN_ANGLE + SERVO_STEP_ANGLE)
                {
                    yaw_angle -= SERVO_STEP_ANGLE;
                }
                else
                {
                    yaw_angle = YAW_MIN_ANGLE;
                }
            }
            else if (rx > 0x90U)
            {
                if (yaw_angle + SERVO_STEP_ANGLE < YAW_MAX_ANGLE)
                {
                    yaw_angle += SERVO_STEP_ANGLE;
                }
                else
                {
                    yaw_angle = YAW_MAX_ANGLE;
                }
            }

            if (ry < 0x70U)
            {
                if (pitch_angle + SERVO_STEP_ANGLE < PITCH_MAX_ANGLE)
                {
                    pitch_angle += SERVO_STEP_ANGLE;
                }
                else
                {
                    pitch_angle = PITCH_MAX_ANGLE;
                }
            }
            else if (ry > 0x90U)
            {
                if (pitch_angle > PITCH_MIN_ANGLE + SERVO_STEP_ANGLE)
                {
                    pitch_angle -= SERVO_STEP_ANGLE;
                }
                else
                {
                    pitch_angle = PITCH_MIN_ANGLE;
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

        /* 简单节流，避免查询过快 */
        delay_ms(20);
 #endif
    }
}
