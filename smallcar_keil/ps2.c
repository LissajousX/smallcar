#include "stm32f10x.h"
#include "ps2.h"

uint8_t  Data[9]  = {0};
uint16_t MASK[16][2] = {
    {PSB_SELECT, 0},
    {PSB_L3,     0},
    {PSB_R3,     0},
    {PSB_START,  0},
    {PSB_PAD_UP,    0},
    {PSB_PAD_RIGHT, 0},
    {PSB_PAD_DOWN,  0},
    {PSB_PAD_LEFT,  0},
    {PSB_L2, 0},
    {PSB_R2, 0},
    {PSB_L1, 0},
    {PSB_R1, 0},
    {PSB_GREEN, 0},
    {PSB_RED,   0},
    {PSB_BLUE,  0},
    {PSB_PINK,  0}
};

uint16_t Handkey = 0;

static uint8_t ps2_mode = PSB_LOSE;
static uint8_t Comd[9] = {0x01, 0x42, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00};

/*
 * 引脚定义（GPIO 方式位操作）：
 * PA4 -> ATT/SEL (CS)
 * PA5 -> CLK
 * PA6 -> DATA (DI, 输入，上拉)
 * PA7 -> CMD  (DO, 输出)
 */

#define PS2_CS_LOW()    (GPIOA->BSRR = GPIO_BSRR_BR4)
#define PS2_CS_HIGH()   (GPIOA->BSRR = GPIO_BSRR_BS4)

#define PS2_SCK_LOW()   (GPIOA->BSRR = GPIO_BSRR_BR5)
#define PS2_SCK_HIGH()  (GPIOA->BSRR = GPIO_BSRR_BS5)

#define PS2_DO_LOW()    (GPIOA->BSRR = GPIO_BSRR_BR7)
#define PS2_DO_HIGH()   (GPIOA->BSRR = GPIO_BSRR_BS7)

static uint8_t PS2_DI_READ(void)
{
    return (GPIOA->IDR & GPIO_IDR_IDR6) ? 1U : 0U;
}

static void PS2_Delay_US(uint32_t us)
{
    /* 简单的软件延时，假设系统时钟约 72MHz，这里不追求绝对精度 */
    uint32_t i;
    while (us--)
    {
        for (i = 0; i < 8U; i++)
        {
            __NOP();
        }
    }
}

static void PS2_GPIO_Init(void)
{
    uint32_t tmp;

    /* 使能 GPIOA 时钟 */
    RCC->APB2ENR |= RCC_APB2ENR_IOPAEN;

    /* PA4, PA5, PA7: 推挽输出 50MHz */
    tmp = GPIOA->CRL;

    /* PA4 */
    tmp &= ~(GPIO_CRL_MODE4 | GPIO_CRL_CNF4);
    tmp |=  (GPIO_CRL_MODE4_0 | GPIO_CRL_MODE4_1); /* 50MHz */
    /* CNF4=00: 通用推挽输出 */

    /* PA5 */
    tmp &= ~(GPIO_CRL_MODE5 | GPIO_CRL_CNF5);
    tmp |=  (GPIO_CRL_MODE5_0 | GPIO_CRL_MODE5_1);

    /* PA7 */
    tmp &= ~(GPIO_CRL_MODE7 | GPIO_CRL_CNF7);
    tmp |=  (GPIO_CRL_MODE7_0 | GPIO_CRL_MODE7_1);

    GPIOA->CRL = tmp;

    /* PA6: 上拉输入 (DATA) */
    tmp = GPIOA->CRL;
    tmp &= ~(GPIO_CRL_MODE6 | GPIO_CRL_CNF6);
    tmp |=  GPIO_CRL_CNF6_1;      /* 输入，上拉/下拉 */
    GPIOA->CRL = tmp;

    /* 上拉 PA6 */
    GPIOA->BSRR = GPIO_BSRR_BS6;

    /* 默认空闲状态：CS 高、SCK 高、DO 高 */
    PS2_CS_HIGH();
    PS2_SCK_HIGH();
    PS2_DO_HIGH();
}

/* 发送一个字节并读取返回 */
static uint8_t PS2_Cmd(uint8_t cmd)
{
    uint8_t i;
    uint8_t mask = 1U;
    uint8_t res = 0U;

    for (i = 0; i < 8U; i++)
    {
        if (cmd & 0x01U)
        {
            PS2_DO_HIGH();
        }
        else
        {
            PS2_DO_LOW();
        }

        cmd >>= 1;

        PS2_Delay_US(10);
        PS2_SCK_LOW();        /* 时钟下降沿输出 */
        PS2_Delay_US(10);

        if (PS2_DI_READ())    /* 在低电平期间采样输入 */
        {
            res |= mask;
        }
        mask <<= 1;

        PS2_SCK_HIGH();       /* 时钟回到高电平 */
        PS2_Delay_US(1);
    }

    return res;
}

void PS2_ReadData(void)
{
    uint8_t byte;

    PS2_CS_LOW();
    PS2_Delay_US(10);

    for (byte = 0; byte < 9U; byte++)
    {
        if (byte < 3U)
        {
            Data[byte] = PS2_Cmd(Comd[byte]);
        }
        else
        {
            Data[byte] = PS2_Cmd(0x00);
        }
    }

    PS2_CS_HIGH();
    PS2_Delay_US(10);
}

uint8_t ps2_key_serch(void)
{
    uint8_t index;
    uint8_t key_num = 0U;

    PS2_ReadData();

    /* Data[3],Data[4] 对应 16 个按键，按下为 0，未按下为 1 */
    Handkey = ((uint16_t)Data[4] << 8) | (uint16_t)Data[3];

    for (index = 4U; index < 16U; index++)
    {
        if ((Handkey & (1U << (MASK[index][0] - 1U))) == 0U)
        {
            MASK[index][1] = 1U;
            key_num++;
        }
        else
        {
            MASK[index][1] = 0U;
        }
    }

    return key_num;
}

uint8_t ps2_get_key_state(uint8_t key_id)
{
    if (key_id < PSB_SELECT)
    {
        return 0U;
    }
    else
    {
        return (uint8_t)MASK[key_id - 1U][1];
    }
}

uint8_t ps2_get_anolog_data(uint8_t button)
{
	/* Data[5..8] 存放摇杆模拟值，直接返回 */
	return Data[button];
}

void PS2_Init(void)
{
    PS2_GPIO_Init();
    ps2_mode = PSB_REDLIGHT_MODE; /* 不依赖模式，仅使用按键 */
    (void)ps2_mode;               /* 仅为消除未使用告警 */
}
