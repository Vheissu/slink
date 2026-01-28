<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <base href="/" />
        <title>{{ config('app.name', 'Slink') }}</title>

        <link rel="preconnect" href="https://fonts.bunny.net">
        <link href="https://fonts.bunny.net/css?family=sora:300,400,500,600,700&family=manrope:400,500,600,700&family=jetbrains-mono:400,500,600" rel="stylesheet" />

        @vite(['resources/css/app.css', 'resources/js/src/main.ts'])
    </head>
    <body class="antialiased">
        <div id="app"></div>
    </body>
</html>
