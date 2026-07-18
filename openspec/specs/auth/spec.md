# Auth Specification

## Purpose

Provide user identity for enchufate-V2 via Supabase Auth. Supports email + password (with email verification) and Google OAuth. The auth state is consumed app-wide by `useSession()` and `useRequireAuth()` to gate auth-aware screens.

## Requirements

### Requirement: Email + Password Sign In

The system SHALL authenticate a user with email and password against Supabase Auth, with email verification required (Supabase default).

#### Scenario: Successful sign in with verified email

- GIVEN a user exists with a verified email
- WHEN the user submits valid credentials on the "Bienvenido de vuelta" screen
- THEN the system establishes a session
- AND navigates the user back to the originating tab
- AND displays the authenticated tab content

#### Scenario: Unverified email blocks sign in

- GIVEN a user registered but has not verified their email
- WHEN the user submits valid credentials
- THEN the system surfaces the message "Verificá tu correo para iniciar sesión"
- AND does NOT establish a session

### Requirement: Google OAuth Sign In

The system SHALL authenticate a user via Google OAuth using the Supabase configured Google provider, returning to the originating tab on success.

#### Scenario: Google OAuth happy path

- GIVEN the user taps "Continuar con Google" on the login screen
- AND the Supabase Google provider is configured
- WHEN the OAuth flow completes
- THEN the system establishes a session
- AND navigates the user back to the originating tab

#### Scenario: Google OAuth user cancels

- GIVEN the user starts the Google OAuth flow
- WHEN the user dismisses the Google account picker
- THEN the system returns to the login screen with no error
- AND no session is created

### Requirement: Sign Up

The system SHALL create a new user account via email + password. The system SHALL require email verification before the user can sign in.

#### Scenario: Successful sign up

- GIVEN a new email and password meeting complexity rules
- WHEN the user submits the sign-up form
- THEN Supabase creates the user
- AND the system displays "Te enviamos un correo para verificar tu cuenta"
- AND a `profiles` row is created with `is_subscribed = false`

#### Scenario: Email already in use

- GIVEN an email already registered
- WHEN the user submits the sign-up form
- THEN the system displays "Ya existe una cuenta con este correo"

### Requirement: Password Reset

The system SHALL send a password-reset email when the user taps "Olvidé mi contraseña" and submits a valid email.

#### Scenario: Reset request for known email

- GIVEN a user taps "Olvidé mi contraseña" and submits a registered email
- WHEN the request is sent
- THEN the system displays "Revisá tu correo para restablecer la contraseña"

### Requirement: Sign Out

The system SHALL end the current session and clear local caches on sign out.

#### Scenario: User signs out from Perfil

- GIVEN an authenticated user on the Perfil tab
- WHEN the user taps "Cerrar sesión"
- THEN the session is ended
- AND TanStack Query caches are cleared
- AND the user lands on the Perfil empty state

## Non-functional notes

- Session refresh happens silently via the Supabase client; no user-visible interruption.
- Auth errors SHALL display inline (not as a system alert) using the destructive text color.
- The login screen SHALL respect password show/hide toggle.
- Email verification is required (Q4 default); no MVP shortcut.
- All auth requests SHALL be rate-limited client-side to avoid spamming Supabase (debounce 800ms on submit).
