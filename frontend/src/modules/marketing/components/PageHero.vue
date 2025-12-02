<script setup lang="ts">
import { Icon } from '@iconify/vue';

defineProps<{
    titleLabel: string;
    titleText: string;
}>();
</script>
<template>
    <div class="navclear bg-black"></div>
    <div class="page-hero bg-white pb-10">
        <div class="container-lg">
            <div class="top-wrapper pt-60 gap-20 flex flex-col">
                <div class="title-wrapper flex flex-col gap-5">
                    <div class="text-xs uppercase">
                        {{ titleLabel }}
                    </div>
                    <div class="text-3xl md:text-6xl md:w-1/2">
                        {{ titleText }}
                    </div>
                </div>
                <p class="flex justify-end">
                    <Icon icon="carbon:chevron-down-outline" width="32" height="32" class="text-black" />
                </p>
            </div>
        </div>
    </div>
</template>
<style scoped lang="css">
</style>
