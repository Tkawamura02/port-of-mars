<script setup lang="ts">
import { ref } from "vue";

const showMenu = ref(false);

function toggleMenu() {
  showMenu.value = !showMenu.value;
}
</script>

<template>
  <header class="w-full fixed items-center top-0 z-10 bg-black shadow-md">
    <nav class="grid grid-cols-2 gap-3 p-6 lg:grid-cols-3 items-center">
      <div class="m-1.5 col-start-1 col-span-1">
        <nuxt-link to="/">
          <img
            class="w-40"
            id="logo"
            src="assets/images/logo-Port-of-Mars-White.svg"
            alt="the planet mars illustrated in white above Port of Mars"
          />
          <h1 class="hidden">Port of Mars</h1>
        </nuxt-link>
      </div>
      <div class="md:hidden m-1.5 col-start-2 col-span-1 justify-self-end">
        <button @click="toggleMenu">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            class="w-6 h-6 fill-current"
            stroke="currentColor"
            strokeWidth="{2}"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
      </div>
      <div
        class="m-1.5 col-span-full md:col-start-2 md:col-span-full md:justify-self-center lg:justify-self-end"
      >
        <ul
          :class="showMenu ? 'flex' : 'hidden'"
          class="flex-col space-y-4 mt-8 md:space-y-0 md:flex md:flex-row md:items-center md:space-x-10 md:mt-0"
        >
          <li class="link"><a href="#about" title="about">About</a></li>
          <li class="link"><a href="#winners" title="winners">Winners</a></li>
          <li class="link"><a href="#news" title="news">News</a></li>
          <li class="link">
            <a href="#gameplay" title="gameplay">Gameplay</a>
          </li>
          <li class="btn btn-main">
            <nuxt-link to="/login">Register</nuxt-link>
          </li>
        </ul>
      </div>
    </nav>
  </header>
</template>
