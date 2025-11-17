#ifndef MOTOR_H
#define MOTOR_H

#include <stdint.h>

/**
 * 初始化 TB6612 和 TIM3，用于控制左右两侧电机。
 * 左侧：TIM3_CH3(PB0) + AIN1(PB12) + AIN2(PB13)
 * 右侧：TIM3_CH4(PB1) + BIN1(PB14) + BIN2(PB15)
 * STBY：PA3
 */
void Motor_Init(void);

/**
 * 设置左右轮占空比和方向。
 * 取值范围：-100 ~ +100，正为前进，负为后退，0 为停止。
 */
void Motor_SetLR(int16_t left, int16_t right);

#endif // MOTOR_H
