#include "stm32f10x.h"
#include "buzzer.h"

#define BUZZER_GPIO GPIOA
#define BUZZER_PIN  8U

/* 每次在主循环中调用 Buzzer_Task() 约对应 20ms（由 main.c 中的 delay_ms(20) 决定） */
#define BUZZER_ON_TICKS   5U  /* 约 100ms */
#define BUZZER_OFF_TICKS  5U  /* 约 100ms */

typedef struct
{
    uint8_t active;
    uint8_t beeps_remaining;
    uint16_t tick_count;
    uint8_t phase; /* 0: idle, 1: on, 2: off-between-beeps */
    uint16_t on_ticks;
    uint16_t off_ticks;
} BuzzerState_t;

static BuzzerState_t s_buzzer = {0};

static void Buzzer_SetOutput(uint8_t on)
{
    if (on)
    {
        BUZZER_GPIO->BSRR = (uint16_t)(1U << BUZZER_PIN);
    }
    else
    {
        BUZZER_GPIO->BRR = (uint16_t)(1U << BUZZER_PIN);
    }
}

static void Buzzer_StartPattern(uint8_t beeps, uint16_t on_ticks, uint16_t off_ticks)
{
    if (s_buzzer.active)
    {
        return;
    }

    s_buzzer.active = 1U;
    s_buzzer.beeps_remaining = beeps;
    s_buzzer.tick_count = 0U;
    s_buzzer.phase = 1U;
    s_buzzer.on_ticks = on_ticks;
    s_buzzer.off_ticks = off_ticks;
    Buzzer_SetOutput(1U);
}

void Buzzer_Init(void)
{
    uint32_t tmp;

    RCC->APB2ENR |= RCC_APB2ENR_IOPAEN;

    tmp = BUZZER_GPIO->CRH;
    tmp &= ~(GPIO_CRH_MODE8 | GPIO_CRH_CNF8);
    tmp |= (GPIO_CRH_MODE8_0 | GPIO_CRH_MODE8_1);
    BUZZER_GPIO->CRH = tmp;

    Buzzer_SetOutput(0U);

    s_buzzer.active = 0U;
    s_buzzer.beeps_remaining = 0U;
    s_buzzer.tick_count = 0U;
    s_buzzer.phase = 0U;
    s_buzzer.on_ticks = BUZZER_ON_TICKS;
    s_buzzer.off_ticks = BUZZER_OFF_TICKS;
}

void Buzzer_StartShortTripleBeep(void)
{
    Buzzer_StartPattern(3U, BUZZER_ON_TICKS, BUZZER_OFF_TICKS);
}

void Buzzer_StartShortSingleBeep(void)
{
    Buzzer_StartPattern(1U, BUZZER_ON_TICKS, BUZZER_OFF_TICKS);
}

void Buzzer_StartPowerOnOkBeep(void)
{
    Buzzer_StartPattern(2U, BUZZER_ON_TICKS, BUZZER_OFF_TICKS);
}

void Buzzer_StartErrorBeep(void)
{
    Buzzer_StartPattern(2U, 10U, BUZZER_OFF_TICKS);
}

void Buzzer_Task(void)
{
    if (!s_buzzer.active)
    {
        return;
    }

    s_buzzer.tick_count++;

    if (s_buzzer.phase == 1U)
    {
        if (s_buzzer.tick_count >= s_buzzer.on_ticks)
        {
            Buzzer_SetOutput(0U);
            s_buzzer.tick_count = 0U;
            s_buzzer.phase = 2U;
        }
    }
    else if (s_buzzer.phase == 2U)
    {
        if (s_buzzer.tick_count >= s_buzzer.off_ticks)
        {
            if (s_buzzer.beeps_remaining > 0U)
            {
                s_buzzer.beeps_remaining--;
            }

            if (s_buzzer.beeps_remaining == 0U)
            {
                s_buzzer.active = 0U;
                s_buzzer.tick_count = 0U;
                s_buzzer.phase = 0U;
                Buzzer_SetOutput(0U);
            }
            else
            {
                s_buzzer.tick_count = 0U;
                s_buzzer.phase = 1U;
                Buzzer_SetOutput(1U);
            }
        }
    }
}
