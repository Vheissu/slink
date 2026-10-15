<?php

namespace App\Support;

class AnalyticsQuery
{
    public static function parse(string $query): array
    {
        $filters = ['url' => [], 'slug' => [], 'title' => [], 'contains' => [], 'free' => []];
        $query = trim($query);

        if (filter_var($query, FILTER_VALIDATE_URL)) {
            $filters['url'][] = $query;

            return $filters;
        }

        // Keep quoted phrases attached to their operator, including title:"two words".
        preg_match_all('/(?:[^\s"\']+|"[^"]*"|\'[^\']*\'|["\'])+/', $query, $matches);
        foreach ($matches[0] as $token) {
            $parts = explode(':', $token, 2);
            $key = strtolower($parts[0]);
            $key = in_array($key, ['link', 'original_url'], true) ? 'url' : $key;

            if (count($parts) === 2 && in_array($key, ['url', 'slug', 'title', 'contains'], true)) {
                $value = self::unquote($parts[1]);
                if ($value !== '') {
                    $filters[$key][] = $value;
                }
            } else {
                $value = self::unquote($token);
                if ($value !== '') {
                    $filters['free'][] = $value;
                }
            }
        }

        return $filters;
    }

    private static function unquote(string $value): string
    {
        if (strlen($value) >= 2 && in_array($value[0], ['"', "'"], true) && $value[0] === $value[-1]) {
            $value = substr($value, 1, -1);
        }

        return trim($value);
    }
}
