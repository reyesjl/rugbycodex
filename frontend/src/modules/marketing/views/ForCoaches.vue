<script setup lang="ts">
import LandingThreeColumnSection from '../components/LandingThreeColumnSection.vue';
import BackgroundHighlightVideo from '../components/BackgroundHighlightVideo.vue';
import herovideo from '@/assets/modules/marketing/highlights.mp4';
</script>
<template>
  <LandingThreeColumnSection
    title="Coaches"
    system-title="Team Learning System"
    system-code="TLS"
    description="Coaches use rugbycodex to break down matches, teach systems, and build a shared understanding across their teams. find patterns faster, see moments in context, and turn narrations into clarity that your players can act on."
    icon="carbon:chevron-down-outline"
  />

  <section class="text-white">
    <BackgroundHighlightVideo 
      :srcMp4="herovideo" 
      :highlights="['0:22','1:34','1:52','0:42','0:57']" 
      :bgClass="'bg-black'"
    />
  </section>

  <section class="bg-black py-20">
    <div class="container-lg flex flex-col space-y-8">

      <!-- Section title -->
      <div class="text-2xl md:text-4xl text-white">Core Functions</div>
      
      <!-- Tabs -->
      <div class="tabs overflow-x-scroll no-scrollbar border-1 border-b-white text-xs md:text-base flex items-center">
        <div class="tab pb-4 pr-8 border-b-1 border-white text-white cursor-pointer font-medium whitespace-nowrap">
          Enhanced Personal Voice
        </div>
        <div class="tab pb-4 pr-8 border-b-1 border-transparent text-gray-500 font-medium cursor-pointer whitespace-nowrap">
          Dynamic Multi-layer Analysis
        </div>
        <div class="tab pb-4 pr-8 border-b-1 border-transparent text-gray-500 font-medium cursor-pointer whitespace-nowrap">
          Predictive Session Planning
        </div>
      </div>

      <!-- Grid wrapper -->
      <div class="bg-white text-black py-8">
        <div class="grid grid-cols-1 md:grid-cols-12 grid-rows-none md:grid-rows-[auto_auto_1fr] gap-8 relative">

          <!-- counter -->
          <div class="order-1 md:order-none 
                      md:col-start-1 md:col-end-2 md:row-start-1 pl-4 text-xs">
            01 / 03
          </div>

          <!--  description -->
          <div class="order-2 md:order-none 
                      md:col-start-3 md:col-end-7 md:row-start-1 space-y-4
                      px-4 md:px-0">
            <div class="desc-title text-xs uppercase tracking-wide">
              Enhanced Personal Voice
            </div>
            <p class="desc-text text-lg md:text-xl max-w-xl leading-snug">
              Coaches can record voice notes during training sessions or matches, which are
            </p>
          </div>

          <!-- right side media (spans all rows) -->
          <div class="order-3 md:order-none 
                      md:col-start-9 md:col-end-13 md:row-start-1 md:row-end-[4] md:pr-8">
            <div class="w-full h-full aspect-video bg-gray-500">
              <!-- drop image/video here -->
            </div>
          </div>

          <!-- giant index number -->
          <div class="order-4 md:order-none 
                      md:col-start-1 md:col-end-2 md:row-start-3 flex items-end pl-4 mb-[-0.5rem]">
            <div class="text-6xl md:text-8xl leading-none">
              1
            </div>
          </div>

        </div>
      </div>
    </div>
  </section>
</template>
