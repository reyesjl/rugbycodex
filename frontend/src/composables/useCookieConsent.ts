import { ref, computed } from 'vue';

const STORAGE_KEY = 'cookie-consent';

type Consent = 'accepted' | 'rejected' | '';

function readStorage(): Consent {
    if (typeof window === 'undefined') return '';
    return (localStorage.getItem(STORAGE_KEY) as Consent) || '';
}

const consent = ref<Consent>(readStorage());

export function useCookieConsent() {
    const hasDecided = computed(() => consent.value === 'accepted' || consent.value === 'rejected');
    const accepted = computed(() => consent.value === 'accepted');
    const rejected = computed(() => consent.value === 'rejected');
    
    function setConsent(value: Consent) {
        consent.value = value;
        if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, value);
            // cookie for server-side access
            // document.cookie = `cookie-consent=${value}; path=/; max-age=${60 * 60 * 24 * 365}`;
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
        hasDecided,
        accepted,
        rejected,
        accept,
        reject,
    };
}
