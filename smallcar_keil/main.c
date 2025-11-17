#include "stm32f10x.h"
#include "motor.h"
#include "ps2.h"
#include "servo.h"

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
    uint8_t ly;
    uint8_t rx;
    uint8_t ry;
    int16_t vx;
    int16_t vy;
    int16_t left_cmd;
    int16_t right_cmd;
    int16_t k_turn = 70; /* 转向系数，百分比 */
    int16_t speed_percent = 50; /* 速度挡位：默认 50% */
    uint16_t yaw_angle = 90U;
    uint16_t pitch_angle = 90U;

    /* 系统时钟在启动文件和 system_stm32f10x.c 中已配置为 72MHz */

    Motor_Init();
    PS2_Init();
    Servo_Init();

    while (1)
    {
        /* 扫描按键/摇杆数据 */
        ps2_key_serch();
        lx = ps2_get_anolog_data(PSS_LX);
        ly = ps2_get_anolog_data(PSS_LY);
        rx = ps2_get_anolog_data(PSS_RX);
        ry = ps2_get_anolog_data(PSS_RY);

        yaw_angle = (uint16_t)(30U + ((uint32_t)rx * (150U - 30U)) / 255U);
        pitch_angle = (uint16_t)(45U + ((uint32_t)(255U - ry) * (135U - 45U)) / 255U);
        Servo_SetYawAngle(yaw_angle);
        Servo_SetPitchAngle(pitch_angle);

        /* 挡位设置：方块/叉号/圆圈/三角形 */
        if (ps2_get_key_state(PSB_PINK))
        {
            /* □ 慢速 */
            speed_percent = 50;
        }
        else if (ps2_get_key_state(PSB_BLUE))
        {
            /* × 中速 */
            speed_percent = 70;
        }
        else if (ps2_get_key_state(PSB_RED))
        {
            /* ○ 快速 */
            speed_percent = 85;
        }
        else if (ps2_get_key_state(PSB_GREEN))
        {
            /* △ 最高速 */
            speed_percent = 100;
        }

        /* 1. 先处理方向键 + L1/R1（优先级最高） */
        if (ps2_get_key_state(PSB_PAD_UP) || ps2_get_key_state(PSB_PAD_DOWN) ||
            ps2_get_key_state(PSB_PAD_LEFT) || ps2_get_key_state(PSB_PAD_RIGHT))
        {
            int16_t base = speed_percent;
            int16_t inner;
            int16_t outer;

            /* 弯道前/后：L1 / R1 + 上/下 */
            if (ps2_get_key_state(PSB_L1) && ps2_get_key_state(PSB_PAD_UP))
            {
                /* 左转前进：左慢右快 */
                inner = (int16_t)(base * 40 / 100);
                outer = base;
                Motor_SetLR(inner, outer);
            }
            else if (ps2_get_key_state(PSB_L1) && ps2_get_key_state(PSB_PAD_DOWN))
            {
                /* 左转后退 */
                inner = (int16_t)(-base * 40 / 100);
                outer = (int16_t)(-base);
                Motor_SetLR(inner, outer);
            }
            else if (ps2_get_key_state(PSB_R1) && ps2_get_key_state(PSB_PAD_UP))
            {
                /* 右转前进：右慢左快 */
                inner = (int16_t)(base * 40 / 100);
                outer = base;
                Motor_SetLR(outer, inner);
            }
            else if (ps2_get_key_state(PSB_R1) && ps2_get_key_state(PSB_PAD_DOWN))
            {
                /* 右转后退 */
                inner = (int16_t)(-base * 40 / 100);
                outer = (int16_t)(-base);
                Motor_SetLR(outer, inner);
            }
            else if (ps2_get_key_state(PSB_PAD_UP))
            {
                /* 直线前进 */
                Motor_SetLR(base, base);
            }
            else if (ps2_get_key_state(PSB_PAD_DOWN))
            {
                /* 直线后退 */
                Motor_SetLR((int16_t)-base, (int16_t)-base);
            }
            else if (ps2_get_key_state(PSB_PAD_LEFT))
            {
                /* 原地左转 */
                Motor_SetLR((int16_t)-base, base);
            }
            else if (ps2_get_key_state(PSB_PAD_RIGHT))
            {
                /* 原地右转 */
                Motor_SetLR(base, (int16_t)-base);
            }
            else
            {
                Motor_SetLR(0, 0);
            }
        }
        else
        {
            /* 2. 没有方向键时使用左摇杆连续控制（仅在红灯模拟模式下启用） */
            /* Data[1] == 0x73 通常表示手柄处于红灯模拟模式 */
            if (Data[1] != 0x73)
            {
                Motor_SetLR(0, 0);
                delay_ms(20);
                continue;
            }

            vx = (int16_t)lx - 0x80; /* 右为正，左为负 */
            vy = 0x80 - (int16_t)ly; /* 上为正，下为负 */

            /* 死区，避免轻微抖动和摇杆零点偏差 */
            if (vx > -20 && vx < 20)
            {
                vx = 0;
            }
            if (vy > -20 && vy < 20)
            {
                vy = 0;
            }

            if (vx == 0 && vy == 0)
            {
                Motor_SetLR(0, 0);
            }
            else
            {
                /* 归一化到大约 -100~100 的区间（0x80≈128） */
                vx = (int16_t)((int32_t)vx * 100 / 128);
                vy = (int16_t)((int32_t)vy * 100 / 128);

                /* 差速混合：left = vy - k*vx, right = vy + k*vx */
                left_cmd  = vy - (int16_t)((int32_t)k_turn * vx / 100);
                right_cmd = vy + (int16_t)((int32_t)k_turn * vx / 100);

                /* 限幅到 -100~100 */
                if (left_cmd > 100)
                    left_cmd = 100;
                else if (left_cmd < -100)
                    left_cmd = -100;

                if (right_cmd > 100)
                    right_cmd = 100;
                else if (right_cmd < -100)
                    right_cmd = -100;

                /* 应用速度挡位缩放 */
                left_cmd  = (int16_t)((int32_t)left_cmd  * speed_percent / 100);
                right_cmd = (int16_t)((int32_t)right_cmd * speed_percent / 100);

                Motor_SetLR(left_cmd, right_cmd);
            }
        }

        /* 简单节流，避免查询过快 */
        delay_ms(20);
    }
}
