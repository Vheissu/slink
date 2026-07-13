<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="description" content="Enter the password to continue to this protected Slink destination.">
        <title>{{ $title ?? config('app.name', 'Slink') }} - Protected</title>

        <link rel="preconnect" href="https://fonts.bunny.net">
        <link href="https://fonts.bunny.net/css?family=hanken-grotesk:400,500,600,700,800&family=jetbrains-mono:400,500,600" rel="stylesheet" />

        @vite(['resources/css/app.css'])
    </head>
    <body class="antialiased">
        <main class="standalone-page">
            <section class="protected-card">
                <a class="brand protected-brand" href="/">
                    <span class="brand-mark" aria-hidden="true">SL</span>
                    <strong class="brand-name">Slink</strong>
                </a>

                <div class="protected-content">
                    <p class="protected-label">Password required</p>
                    <h1>{{ $title ?? 'This link' }} is protected</h1>
                    <p>Enter the password to continue to the destination.</p>

                    <form class="protected-form" method="POST" action="{{ url('/' . $slug . '/verify') }}">
                        @csrf
                        <div class="input-shell">
                            <label for="link-password">Password</label>
                            <input
                                id="link-password"
                                class="input-field"
                                type="password"
                                name="password"
                                autocomplete="current-password"
                                autofocus
                                required
                            />
                        </div>

                        @if (!empty($error))
                            <p class="form-error" role="alert">{{ $error }}</p>
                        @endif

                        <button class="btn-primary" type="submit">Continue</button>
                    </form>
                </div>
            </section>
        </main>
    </body>
</html>
