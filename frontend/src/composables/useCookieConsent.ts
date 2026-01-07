import { ref, computed } from 'vue';

const STORAGE_KEY = 'cookie-consent';
const DISMISSED_KEY = 'cookie-consent-dismissed';

type Consent = 'accepted' | 'rejected' | '';

function readStorage(): Consent {
    if (typeof window === 'undefined') return '';
    return (localStorage.getItem(STORAGE_KEY) as Consent) || '';
}

function readDismissed(): boolean {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem(DISMISSED_KEY) === '1';
}

const consent = ref<Consent>(readStorage());
const dismissed = ref<boolean>(readDismissed());

export function useCookieConsent() {
    const hasDecided = computed(() => consent.value === 'accepted' || consent.value === 'rejected');
    const accepted = computed(() => consent.value === 'accepted');
    const rejected = computed(() => consent.value === 'rejected');
    const shouldShowBanner = computed(() => !hasDecided.value && !dismissed.value);
    
    function setConsent(value: Consent) {
        consent.value = value;
        if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, value);
            sessionStorage.removeItem(DISMISSED_KEY);
            dismissed.value = false;
            // cookie for server-side access
            // document.cookie = `cookie-consent=${value}; path=/; max-age=${60 * 60 * 24 * 365}`;
        }
    }

    function dismiss() {
        dismissed.value = true;
        if (typeof window !== 'undefined') {
            sessionStorage.setItem(DISMISSED_KEY, '1');
        }
    }

    function accept() {
        setConsent('accepted');
    }

    function reject() {
        setConsent('rejected');
    }
    
    return {
        consent,
        dismissed,
        hasDecided,
        accepted,
        rejected,
        shouldShowBanner,
        accept,
        reject,
        dismiss,
    };
}
