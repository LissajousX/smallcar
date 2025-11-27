// SmallCar web front-end build profiles.
// CI can generate different variants by modifying `activeProfile` or the URLs below.

window.SMALLCAR_CONFIG = {
  // 当前激活的 profile 名称。CI 可以在构建时改成其它值，例如 "product"。
  activeProfile: "product",

  // 各环境默认配置
  profiles: {
    // geek：开发 / 极客版本，用于本地调试或路由器开发环境
    geek: {
      mode: "geek",
      defaultWsUrl: "ws://192.168.31.140:8765/ws_control",
      defaultVideoUrl: "http://192.168.31.140:81/stream",
      defaultRouterBase: "http://192.168.31.1:8099",
    },

    // product：产品版，所有地址从 window.location 推导
    product: {
      mode: "product",
    },
  },
};
