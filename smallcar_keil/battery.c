#include "stm32f10x.h"
#include "battery.h"

#define BAT_VREF_MV           3300U
#define BAT_DIVIDER_RATIO     5U
#define BAT_FULL_MV           12600U
#define BAT_EMPTY_MV          9000U
#define BAT_ADC_SAMPLE_TIMES  8U

static void Battery_DelayMs(uint32_t ms)
{
    uint32_t i;
    uint32_t j;

    for (i = 0; i < ms; i++)
    {
        for (j = 0; j < 8000; j++)
        {
            __NOP();
        }
    }
}

static uint16_t Battery_ADC_ReadRaw(void)
{
    uint32_t sum = 0U;
    uint8_t i;

    for (i = 0U; i < BAT_ADC_SAMPLE_TIMES; i++)
    {
        ADC1->SQR3 = 2U;
        ADC1->CR2 |= ADC_CR2_ADON;
        while ((ADC1->SR & ADC_SR_EOC) == 0U)
        {
        }
        sum += ADC1->DR;
    }

    sum /= BAT_ADC_SAMPLE_TIMES;
    if (sum > 4095U)
    {
        sum = 4095U;
    }

    return (uint16_t)sum;
}

void Battery_ADC_Init(void)
{
    uint32_t tmp;

    RCC->APB2ENR |= RCC_APB2ENR_IOPAEN | RCC_APB2ENR_ADC1EN;

    tmp = GPIOA->CRL;
    tmp &= ~(GPIO_CRL_MODE2 | GPIO_CRL_CNF2);
    GPIOA->CRL = tmp;

    tmp = RCC->CFGR;
    tmp &= ~RCC_CFGR_ADCPRE;
    tmp |= RCC_CFGR_ADCPRE_DIV6;
    RCC->CFGR = tmp;

    ADC1->SMPR2 &= ~ADC_SMPR2_SMP2;
    ADC1->SMPR2 |= ADC_SMPR2_SMP2_0 | ADC_SMPR2_SMP2_1 | ADC_SMPR2_SMP2_2;

    ADC1->SQR1 = 0U;
    ADC1->SQR2 = 0U;
    ADC1->SQR3 = 2U;

    ADC1->CR2 |= ADC_CR2_ADON;
    Battery_DelayMs(1U);
    ADC1->CR2 |= ADC_CR2_RSTCAL;
    while ((ADC1->CR2 & ADC_CR2_RSTCAL) != 0U)
    {
    }
    ADC1->CR2 |= ADC_CR2_CAL;
    while ((ADC1->CR2 & ADC_CR2_CAL) != 0U)
    {
    }
}

uint32_t Battery_GetVoltage_mV(void)
{
    uint16_t raw;
    uint32_t mv;

    raw = Battery_ADC_ReadRaw();
    mv = (uint32_t)raw * BAT_VREF_MV * BAT_DIVIDER_RATIO / 4095U;

    return mv;
}

uint8_t Battery_ConvertPercent(uint32_t mv)
{
    uint32_t percent;

    if (mv <= BAT_EMPTY_MV)
    {
        return 0U;
    }
    if (mv >= BAT_FULL_MV)
    {
        return 100U;
    }

    percent = (mv - BAT_EMPTY_MV) * 100U / (BAT_FULL_MV - BAT_EMPTY_MV);
    if (percent > 100U)
    {
        percent = 100U;
    }

    return (uint8_t)percent;
}
