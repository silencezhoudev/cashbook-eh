// You can use `defineI18nConfig` to get type inferences for options to pass to vue-i18n.
export default defineI18nConfig(() => {
  return {
    legacy: false,
    locale: "zh",
    messages: {
      en: {
        title: "{ait}LOG",
        hello: "Welcome",
        menu: {
          menu1: "menu1",
          menu2: "menu2",
          menu3: "menu3",
          menu4: "menu4"
        }
      },
      zh: {
        title: "记账本",
        hello: "欢迎",
        menu: {
          menu1: "菜单1",
          menu2: "菜单2",
          menu3: "菜单3",
          menu4: "菜单4"
        }
      },
    },
  };
});
