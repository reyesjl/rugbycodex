<script setup lang="ts">
import CoachGuide from '@/modules/app/components/CoachGuide.vue';
import OrganizationsSection from './admin/OrganizationsSection.vue';
import OperationsSection from './admin/OperationsSection.vue';
import PeopleSection from './admin/PeopleSection.vue';


</script>

<template>
  <section class="space-y-20 text-white">
    <div class="header space-y-5">
      <div class="text-2xl">Platform status</div>
      <CoachGuide>
        <div class="space-y-1">
          <p class="text-lg font-semibold text-white/90">All system operational.</p>
          <p class="text-sm text-white/70">TMO looks good from all angles.</p>
        </div>
      </CoachGuide>
    </div>


    <OrganizationsSection />

    <OperationsSection />
    
    <PeopleSection />

  </section>
</template>
