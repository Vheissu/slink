<?php

namespace Tests\Feature;

use App\Models\Link;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ProtectedLinkTest extends TestCase
{
    use RefreshDatabase;

    public function test_protected_links_render_the_password_form(): void
    {
        $link = $this->protectedLink();

        $this->get('/'.$link->slug)
            ->assertOk()
            ->assertViewIs('link-password')
            ->assertSee('Private notes is protected')
            ->assertSee('name="_token"', false)
            ->assertSee('autocomplete="current-password"', false);
    }

    public function test_an_incorrect_link_password_returns_to_the_form_with_an_error(): void
    {
        $link = $this->protectedLink();

        $this->post('/'.$link->slug.'/verify', ['password' => 'incorrect'])
            ->assertRedirect('/'.$link->slug)
            ->assertSessionHas('error', 'Invalid password');
    }

    private function protectedLink(): Link
    {
        $user = User::factory()->create();

        return Link::create([
            'user_id' => $user->id,
            'original_url' => 'https://example.com/private',
            'slug' => 'private-notes',
            'title' => 'Private notes',
            'password' => Hash::make('letmein'),
        ]);
    }
}
