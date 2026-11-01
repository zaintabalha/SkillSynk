import { useEffect, useRef, type ReactNode } from 'react';
import { ClerkProvider, useAuth, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/shared/keys';
import { shadcn } from '@clerk/themes';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Redirect, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import { LoadingScreen, basePath } from '@/components/shell';
import { I18nProvider, useI18n } from '@/lib/i18n';
import { HomePage, NotFoundPage, SignInPage, SignUpPage } from '@/pages/public';
import { DashboardPage, MatchesPage, ProfilePage, RoomsPage } from '@/pages/student';
import { RoomDetailPage } from '@/pages/room';
import { AdminPage } from '@/pages/admin';
import './index.css';
import './room-admin.css';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 1 } } });
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

const appearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#3f745e', colorForeground: '#294238', colorMutedForeground: '#718077',
    colorDanger: '#b64b40', colorBackground: '#fbfaf6', colorInput: '#fffefa',
    colorInputForeground: '#294238', colorNeutral: '#d9ded6',
    fontFamily: 'DM Sans, sans-serif', borderRadius: '1rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fbfaf6] rounded-[24px] w-[440px] max-w-full overflow-hidden',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#294238] font-bold tracking-tight',
    headerSubtitle: 'text-[#718077]',
    socialButtonsBlockButtonText: 'text-[#294238] font-semibold',
    formFieldLabel: 'text-[#294238] font-semibold',
    footerActionLink: 'text-[#3f745e] font-semibold',
    footerActionText: 'text-[#718077]',
    dividerText: 'text-[#718077]',
    identityPreviewEditButton: 'text-[#3f745e]',
    formFieldSuccessText: 'text-[#3f745e]',
    alertText: 'text-[#294238]',
    logoBox: 'mb-4',
    logoImage: 'h-9',
    socialButtonsBlockButton: 'rounded-xl border-[#d9ded6] bg-[#fffefa]',
    formButtonPrimary: 'rounded-xl bg-[#3f745e] hover:bg-[#315d4b] text-white',
    formFieldInput: 'rounded-xl border-[#d9ded6] bg-[#fffefa] text-[#294238]',
    footerAction: 'text-[#718077]',
    dividerLine: 'bg-[#d9ded6]',
    alert: 'rounded-xl',
    otpCodeFieldInput: 'rounded-xl border-[#d9ded6] text-[#294238]',
    formFieldRow: 'mb-4',
    main: 'gap-5',
  },
};

function Protected({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <LoadingScreen />;
  if (!isSignedIn) return <Redirect to="/" />;
  return <>{children}</>;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const cache = useQueryClient();
  const previous = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const id = user?.id ?? null;
      if (previous.current !== undefined && previous.current !== id) cache.clear();
      previous.current = id;
    });
    return unsubscribe;
  }, [addListener, cache]);
  return null;
}


function RoutedPages() {
  const [, setLocation] = useLocation();
  const { t } = useI18n();
  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    appearance={appearance}
    signInUrl={`${basePath}/sign-in`}
    signUpUrl={`${basePath}/sign-up`}
    localization={{ signIn: { start: { title: t('clerkSignInTitle'), subtitle: t('clerkSignInSubtitle') } }, signUp: { start: { title: t('clerkSignUpTitle'), subtitle: t('clerkSignUpSubtitle') } } }}
    routerPush={(to: string) => setLocation(stripBase(to))}
    routerReplace={(to: string) => setLocation(stripBase(to), { replace: true })}
  >
    <QueryClientProvider client={queryClient}>
      <ClerkQueryClientCacheInvalidator />
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route path="/dashboard"><Protected><DashboardPage /></Protected></Route>
        <Route path="/profile"><Protected><ProfilePage /></Protected></Route>
        <Route path="/matches"><Protected><MatchesPage /></Protected></Route>
        <Route path="/rooms"><Protected><RoomsPage /></Protected></Route>
        <Route path="/rooms/:roomId"><Protected><RoomDetailPage /></Protected></Route>
        <Route path="/admin"><Protected><AdminPage /></Protected></Route>
        <Route component={NotFoundPage} />
      </Switch>
    </QueryClientProvider>
  </ClerkProvider>;
}

function App() {
  if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
  return <I18nProvider><WouterRouter base={basePath}><RoutedPages /></WouterRouter></I18nProvider>;
}

export default App;
