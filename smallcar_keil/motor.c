#include "stm32f10x.h"
#include "motor.h"

static void GPIO_Config(void);
static void TIM3_PWM_Config(void);

void Motor_Init(void)
{
    /* Enable clocks for GPIOA, GPIOB and AFIO */
    RCC->APB2ENR |= RCC_APB2ENR_IOPAEN | RCC_APB2ENR_IOPBEN | RCC_APB2ENR_AFIOEN;
    /* Enable clock for TIM3 */
    RCC->APB1ENR |= RCC_APB1ENR_TIM3EN;

    GPIO_Config();
    TIM3_PWM_Config();

    /* Enable TB6612 STBY (PA3 high) */
    GPIOA->BSRR = GPIO_BSRR_BS3;
}

void Motor_SetLR(int16_t left, int16_t right)
{
    int16_t l = left;
    int16_t r = right;
    uint16_t arr = TIM3->ARR + 1U;
    uint16_t duty_l, duty_r;
    uint16_t min_duty;

    if (l > 100)  l = 100;
    if (l < -100) l = -100;
    if (r > 100)  r = 100;
    if (r < -100) r = -100;

    /* 最小有效占空比，大约 20% */
    min_duty = (uint16_t)((arr * 30U) / 100U);

    /* Left wheel */
    if (l > 0)
    {
        /* forward: AIN1=1, AIN2=0 */
        GPIOB->BSRR = GPIO_BSRR_BS12;
        GPIOB->BSRR = GPIO_BSRR_BR13;
        duty_l = (uint16_t)((arr * (uint32_t)l) / 100U);
        if (duty_l < min_duty)
        {
            duty_l = min_duty;
        }
    }
    else if (l < 0)
    {
        /* backward: AIN1=0, AIN2=1 */
        GPIOB->BSRR = GPIO_BSRR_BR12;
        GPIOB->BSRR = GPIO_BSRR_BS13;
        duty_l = (uint16_t)((arr * (uint32_t)(-l)) / 100U);
        if (duty_l < min_duty)
        {
            duty_l = min_duty;
        }
    }
    else
    {
        /* stop */
        duty_l = 0;
    }

    /* Right wheel */
    if (r > 0)
    {
        /* forward: BIN1=1, BIN2=0 */
        GPIOB->BSRR = GPIO_BSRR_BS14;
        GPIOB->BSRR = GPIO_BSRR_BR15;
        duty_r = (uint16_t)((arr * (uint32_t)r) / 100U);
        if (duty_r < min_duty)
        {
            duty_r = min_duty;
        }
    }
    else if (r < 0)
    {
        /* backward: BIN1=0, BIN2=1 */
        GPIOB->BSRR = GPIO_BSRR_BR14;
        GPIOB->BSRR = GPIO_BSRR_BS15;
        duty_r = (uint16_t)((arr * (uint32_t)(-r)) / 100U);
        if (duty_r < min_duty)
        {
            duty_r = min_duty;
        }
    }
    else
    {
        duty_r = 0;
    }

    TIM3->CCR3 = duty_l;
    TIM3->CCR4 = duty_r;
}

static void GPIO_Config(void)
{
    uint32_t tmp;

    /* PA3: output push-pull 50MHz (STBY) */
    tmp = GPIOA->CRL;
    tmp &= ~(GPIO_CRL_MODE3 | GPIO_CRL_CNF3);
    tmp |=  (GPIO_CRL_MODE3_0 | GPIO_CRL_MODE3_1); /* MODE3 = 11 (50MHz) */
    /* CNF3 = 00 (GP push-pull) */
    GPIOA->CRL = tmp;

    /* PB0, PB1: AF push-pull 50MHz (TIM3_CH3, CH4) */
    tmp = GPIOB->CRL;
    /* PB0 */
    tmp &= ~(GPIO_CRL_MODE0 | GPIO_CRL_CNF0);
    tmp |=  (GPIO_CRL_MODE0_0 | GPIO_CRL_MODE0_1); /* 50MHz */
    tmp |=  GPIO_CRL_CNF0_1;                       /* AF push-pull: CNF=10 */
    /* PB1 */
    tmp &= ~(GPIO_CRL_MODE1 | GPIO_CRL_CNF1);
    tmp |=  (GPIO_CRL_MODE1_0 | GPIO_CRL_MODE1_1);
    tmp |=  GPIO_CRL_CNF1_1;
    GPIOB->CRL = tmp;

    /* PB12~PB15: output push-pull 50MHz (direction pins) */
    tmp = GPIOB->CRH;
    /* PB12 */
    tmp &= ~(GPIO_CRH_MODE12 | GPIO_CRH_CNF12);
    tmp |=  (GPIO_CRH_MODE12_0 | GPIO_CRH_MODE12_1);
    /* PB13 */
    tmp &= ~(GPIO_CRH_MODE13 | GPIO_CRH_CNF13);
    tmp |=  (GPIO_CRH_MODE13_0 | GPIO_CRH_MODE13_1);
    /* PB14 */
    tmp &= ~(GPIO_CRH_MODE14 | GPIO_CRH_CNF14);
    tmp |=  (GPIO_CRH_MODE14_0 | GPIO_CRH_MODE14_1);
    /* PB15 */
    tmp &= ~(GPIO_CRH_MODE15 | GPIO_CRH_CNF15);
    tmp |=  (GPIO_CRH_MODE15_0 | GPIO_CRH_MODE15_1);
    GPIOB->CRH = tmp;
}

static void TIM3_PWM_Config(void)
{
    /* Set timer base: 1kHz PWM at 72MHz core clock */
    TIM3->PSC = 72 - 1;          /* 72MHz / 72 = 1MHz */
    TIM3->ARR = 1000 - 1;        /* 1MHz / 1000 = 1kHz */

    /* PWM mode 1 on CH3 and CH4, enable preload */
    /* CH3 and CH4 are in CCMR2; for F1, OC3M bits are [6:4], OC4M bits are [14:12] */
    TIM3->CCMR2 &= ~(TIM_CCMR2_OC3M | TIM_CCMR2_OC4M |
                     TIM_CCMR2_CC3S | TIM_CCMR2_CC4S);
    TIM3->CCMR2 |= (TIM_CCMR2_OC3M_2 | TIM_CCMR2_OC3M_1) | TIM_CCMR2_OC3PE; /* OC3M = 110: PWM1 */
    TIM3->CCMR2 |= (TIM_CCMR2_OC4M_2 | TIM_CCMR2_OC4M_1) | TIM_CCMR2_OC4PE; /* OC4M = 110: PWM1 */

    /* Enable capture/compare outputs */
    TIM3->CCER |= TIM_CCER_CC3E | TIM_CCER_CC4E;

    /* Auto-reload preload enable */
    TIM3->CR1 |= TIM_CR1_ARPE;

    /* Start timer */
    TIM3->CR1 |= TIM_CR1_CEN;
}
