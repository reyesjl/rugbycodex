import { computed, onBeforeUnmount, onMounted, ref, type Ref } from 'vue';

type SidebarGestureOptions = {
    isOpen: Ref<boolean>;
    onToggle: () => void;
};

export function useSidebarGestures({ isOpen, onToggle }: SidebarGestureOptions) {
    const mobileSheetRef = ref<HTMLElement | null>(null);
    const sheetHeight = ref(0);
    const isDragging = ref(false);
    const dragStartY = ref(0);
    const dragLastY = ref(0);
    const dragBaseY = ref(0);
    const dragTranslate = ref(0);
    const dragStartTime = ref(0);
    const dragLastTime = ref(0);

    const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

    const updateSheetHeight = () => {
        const sheet = mobileSheetRef.value;
        sheetHeight.value = sheet ? sheet.getBoundingClientRect().height : 0;
    };

    const startDrag = (clientY: number) => {
        updateSheetHeight();
        if (!sheetHeight.value) {
            return;
        }

        isDragging.value = true;
        dragStartY.value = clientY;
        dragLastY.value = clientY;

        const now = performance.now();
        dragStartTime.value = now;
        dragLastTime.value = now;

        dragBaseY.value = isOpen.value ? 0 : sheetHeight.value;
        dragTranslate.value = dragBaseY.value;
    };

    const updateDrag = (clientY: number) => {
        if (!isDragging.value) {
            return;
        }

        dragLastY.value = clientY;
        dragLastTime.value = performance.now();

        const delta = clientY - dragStartY.value;
        dragTranslate.value = clamp(dragBaseY.value + delta, 0, sheetHeight.value);
    };

    const endDrag = () => {
        if (!isDragging.value) {
            return;
        }

        isDragging.value = false;

        if (!sheetHeight.value) {
            return;
        }

        const threshold = sheetHeight.value * 0.5;
        const totalDelta = dragLastY.value - dragStartY.value;
        const elapsed = Math.max(1, dragLastTime.value - dragStartTime.value);
        const velocity = totalDelta / elapsed;
        let shouldOpen = dragTranslate.value < threshold;

        if (velocity < -0.6) {
            shouldOpen = true;
        } else if (velocity > 0.6) {
            shouldOpen = false;
        }

        if (shouldOpen !== isOpen.value) {
            onToggle();
        }
    };

    const sheetStyle = computed(() => {
        if (!sheetHeight.value) {
            return {};
        }

        const translate = isDragging.value ? dragTranslate.value : (isOpen.value ? 0 : sheetHeight.value);

        return {
            transform: `translateY(${translate}px)`,
            transitionDuration: isDragging.value ? '0ms' : '300ms',
        };
    });

    const isInteractiveTarget = (target: EventTarget | null) => {
        if (!(target instanceof HTMLElement)) {
            return false;
        }

        return Boolean(target.closest('button, a, [data-no-drag]'));
    };

    const onHandlePointerDown = (event: PointerEvent) => {
        if (event.button !== 0 || isInteractiveTarget(event.target)) {
            return;
        }

        startDrag(event.clientY);
        (event.currentTarget as HTMLElement)?.setPointerCapture?.(event.pointerId);
    };

    const onHandlePointerMove = (event: PointerEvent) => {
        if (!isDragging.value) {
            return;
        }

        updateDrag(event.clientY);
        event.preventDefault();
    };

    const onHandlePointerUp = () => {
        endDrag();
    };

    const onEdgePointerDown = (event: PointerEvent) => {
        if (event.button !== 0) {
            return;
        }

        startDrag(event.clientY);
        (event.currentTarget as HTMLElement)?.setPointerCapture?.(event.pointerId);
    };

    const onEdgePointerMove = (event: PointerEvent) => {
        if (!isDragging.value) {
            return;
        }

        updateDrag(event.clientY);
        event.preventDefault();
    };

    const onEdgePointerUp = () => {
        endDrag();
    };

    onMounted(() => {
        updateSheetHeight();
        window.addEventListener('resize', updateSheetHeight);
    });

    onBeforeUnmount(() => {
        window.removeEventListener('resize', updateSheetHeight);
    });

    return {
        mobileSheetRef,
        sheetStyle,
        onHandlePointerDown,
        onHandlePointerMove,
        onHandlePointerUp,
        onEdgePointerDown,
        onEdgePointerMove,
        onEdgePointerUp,
    };
}
