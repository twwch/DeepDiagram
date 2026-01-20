// Google Identity Services types
declare namespace google {
    namespace accounts {
        namespace id {
            interface CredentialResponse {
                credential: string;
                select_by: string;
                clientId?: string;
            }

            interface PromptMomentNotification {
                isDisplayMoment(): boolean;
                isDisplayed(): boolean;
                isNotDisplayed(): boolean;
                getNotDisplayedReason(): string;
                isSkippedMoment(): boolean;
                getSkippedReason(): string;
                isDismissedMoment(): boolean;
                getDismissedReason(): string;
                getMomentType(): string;
            }

            interface GsiButtonConfiguration {
                type?: 'standard' | 'icon';
                theme?: 'outline' | 'filled_blue' | 'filled_black';
                size?: 'large' | 'medium' | 'small';
                text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
                shape?: 'rectangular' | 'pill' | 'circle' | 'square';
                logo_alignment?: 'left' | 'center';
                width?: string | number;
                locale?: string;
            }

            interface IdConfiguration {
                client_id: string;
                callback?: (response: CredentialResponse) => void;
                auto_select?: boolean;
                login_uri?: string;
                native_callback?: (response: CredentialResponse) => void;
                cancel_on_tap_outside?: boolean;
                prompt_parent_id?: string;
                nonce?: string;
                context?: 'signin' | 'signup' | 'use';
                state_cookie_domain?: string;
                ux_mode?: 'popup' | 'redirect';
                allowed_parent_origin?: string | string[];
                intermediate_iframe_close_callback?: () => void;
                itp_support?: boolean;
            }

            function initialize(config: IdConfiguration): void;
            function prompt(momentListener?: (notification: PromptMomentNotification) => void): void;
            function renderButton(parent: HTMLElement, options: GsiButtonConfiguration): void;
            function disableAutoSelect(): void;
            function storeCredential(credential: { id: string; password: string }, callback?: () => void): void;
            function cancel(): void;
            function revoke(hint: string, callback?: (response: { successful: boolean; error?: string }) => void): void;
        }
    }
}

interface Window {
    google?: typeof google;
}
