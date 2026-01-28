<?php

return [
    'abilities' => [
        '*',
        'links:read',
        'links:write',
        'tags:read',
        'tags:write',
        'analytics:read',
        'user:read',
        'tokens:write',
        'health:read',
        'audit:read',
    ],
    'default' => ['*'],
];
