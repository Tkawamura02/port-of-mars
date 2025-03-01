<template>
  <b-container class="h-100 p-0 m-0 bg" fluid>
    <b-row no-gutters class="h-100 w-100">
      <Navbar v-if="!isGamePage"></Navbar>
      <router-view :class="bodyClass" :key="topLevelPath"></router-view>
    </b-row>
  </b-container>
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";
import BootstrapVue from "bootstrap-vue";
import Navbar from "@port-of-mars/client/components/global/Navbar.vue";
import Footer from "@port-of-mars/client/components/global/Footer.vue";
import {
  GAME_PAGE,
  MANUAL_PAGE,
  LOBBY_PAGE,
  HOME_PAGE,
  ABOUT_PAGE,
  PRIVACY_PAGE,
} from "@port-of-mars/shared/routes";
import _ from "lodash";
Vue.use(BootstrapVue);

@Component({
  components: {
    Navbar,
    Footer,
  },
})
export default class App extends Vue {
  game = { name: GAME_PAGE };
  manual = { name: MANUAL_PAGE };
  lobby = { name: LOBBY_PAGE };
  home = { name: HOME_PAGE };
  about = { name: ABOUT_PAGE };
  privacy = { name: PRIVACY_PAGE };

  get topLevelPath() {
    return this.$route.path.split("/")[1];
  }

  get isGamePage() {
    if (_.isNil(this.$route.name)) {
      return false;
    } else {
      return this.game.name === this.$route.name;
    }
  }

  get isScrollable() {
    if (_.isNil(this.$route.name)) {
      return false;
    } else {
      return (
        this.manual.name === this.$route.name ||
        this.home.name === this.$route.name ||
        this.about.name === this.$route.name ||
        this.privacy.name === this.$route.name
      );
    }
  }

  get bodyClass() {
    return [
      { "h-100": !this.isScrollable },
      { "d-flex": !this.isScrollable },
      { "flex-grow-1": !this.isScrollable },
      { "h-auto": this.isScrollable },
      { "body-content": !this.isGamePage },
    ];
  }
}
</script>

<style lang="scss">
/* IMPORT BOOTSTRAP */
@import "./stylesheets/bootstrap-customize";
@import "~bootstrap/scss/bootstrap";
@import "~bootstrap-vue/src/index";

/* IMPORT ANIMATE.CSS (BASE) */
@import "~animate.css/source/_base.css";

/* IMPORT SCSS */
@import "./stylesheets/main.scss";

.body-content {
  padding-top: 85px !important;
}

.bg {
  background-color: var(--dark-shade);
  background-size: cover;
}
</style>
