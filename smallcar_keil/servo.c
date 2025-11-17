#include "stm32f10x.h"
#include "servo.h"

/* 简单将 0~180 度映射为 1.0ms~2.0ms 脉宽（在 1MHz 计数下即 1000~2000 计数） */
static uint16_t Servo_AngleToCCR(uint16_t angle)
{
    uint32_t pulse;

    if (angle > 180U)
    {
        angle = 180U;
    }

    /* 1.0ms + angle/180 * 1.0ms -> 1000~2000 */
    pulse = 1000U + ((uint32_t)angle * 1000U) / 180U;

    return (uint16_t)pulse;
}

void Servo_Init(void)
{
    uint32_t tmp;

    /* 使能 GPIOA 和 AFIO、TIM2 时钟 */
    RCC->APB2ENR |= RCC_APB2ENR_IOPAEN | RCC_APB2ENR_AFIOEN;
    RCC->APB1ENR |= RCC_APB1ENR_TIM2EN;

    /* PA0, PA1: 复用推挽输出 50MHz (TIM2_CH1, TIM2_CH2) */
    tmp = GPIOA->CRL;

    /* PA0 */
    tmp &= ~(GPIO_CRL_MODE0 | GPIO_CRL_CNF0);
    tmp |=  (GPIO_CRL_MODE0_0 | GPIO_CRL_MODE0_1); /* 50MHz */
    tmp |=  GPIO_CRL_CNF0_1;                       /* AF push-pull: CNF=10 */

    /* PA1 */
    tmp &= ~(GPIO_CRL_MODE1 | GPIO_CRL_CNF1);
    tmp |=  (GPIO_CRL_MODE1_0 | GPIO_CRL_MODE1_1);
    tmp |=  GPIO_CRL_CNF1_1;

    GPIOA->CRL = tmp;

    /* 定时器基础配置：1MHz 计数频率，周期 20ms (50Hz) */
    TIM2->PSC = 72U - 1U;          /* 72MHz / 72 = 1MHz */
    TIM2->ARR = 20000U - 1U;       /* 1MHz / 20000 = 50Hz */

    /* PWM1 模式，通道 1 和 2，开启预装载 */
    TIM2->CCMR1 &= ~(TIM_CCMR1_OC1M | TIM_CCMR1_CC1S |
                     TIM_CCMR1_OC2M | TIM_CCMR1_CC2S);
    TIM2->CCMR1 |= (TIM_CCMR1_OC1M_2 | TIM_CCMR1_OC1M_1) | TIM_CCMR1_OC1PE; /* OC1M = 110: PWM1 */
    TIM2->CCMR1 |= (TIM_CCMR1_OC2M_2 | TIM_CCMR1_OC2M_1) | TIM_CCMR1_OC2PE; /* OC2M = 110: PWM1 */

    /* 使能通道输出 */
    TIM2->CCER |= TIM_CCER_CC1E | TIM_CCER_CC2E;

    /* 允许自动重装载缓冲 */
    TIM2->CR1 |= TIM_CR1_ARPE;

    /* 设定初始位置为 90 度 */
    TIM2->CCR1 = Servo_AngleToCCR(90U);
    TIM2->CCR2 = Servo_AngleToCCR(90U);

    /* 启动定时器 */
    TIM2->CR1 |= TIM_CR1_CEN;
}

void Servo_SetYawAngle(uint16_t angle)
{
    TIM2->CCR1 = Servo_AngleToCCR(angle);
}

void Servo_SetPitchAngle(uint16_t angle)
{
    TIM2->CCR2 = Servo_AngleToCCR(angle);
}
