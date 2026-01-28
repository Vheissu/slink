<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>{{ $title ?? config('app.name', 'Slink') }} · Protected</title>

        <link rel="preconnect" href="https://fonts.bunny.net">
        <link href="https://fonts.bunny.net/css?family=sora:300,400,500,600,700&family=manrope:400,500,600,700&family=jetbrains-mono:400,500,600" rel="stylesheet" />

        @vite(['resources/css/app.css'])
    </head>
    <body class="antialiased">
        <div class="min-h-screen px-6 py-16">
            <div class="mx-auto max-w-lg">
                <div class="panel">
                    <p class="text-xs uppercase tracking-[0.3em] text-slink-muted">Protected link</p>
                    <h1 class="mt-2 font-display text-2xl">{{ $title ?? 'This link' }} requires a password</h1>
                    <p class="mt-2 text-sm text-slink-muted">
                        Enter the password to continue to the destination.
                    </p>

                    <form class="mt-6 space-y-4" method="POST" action="{{ url('/' . $slug . '/verify') }}">
                        @csrf
                        <div class="input-shell">
                            <label class="text-xs uppercase tracking-[0.3em] text-slink-muted">Password</label>
                            <input
                                class="input-field"
                                type="password"
                                name="password"
                                autocomplete="current-password"
                                required
                            />
                        </div>

                        @if (!empty($error))
                            <p class="text-sm text-rose-600">{{ $error }}</p>
                        @endif

                        <button class="btn-primary w-full" type="submit">Unlock link</button>
                    </form>
                </div>
            </div>
        </div>
    </body>
</html>
