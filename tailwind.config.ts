import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			fontFamily: {
				sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
				headline: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
				body: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
				label: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
			},
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))',
					glow: 'hsl(var(--primary-glow))',
					container: 'hsl(var(--primary-container))',
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))',
					container: 'hsl(var(--secondary-container))',
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				},
				surface: {
					DEFAULT: 'hsl(var(--surface))',
					dim: 'hsl(var(--surface-dim))',
					bright: 'hsl(var(--surface-bright))',
					'container-lowest': 'hsl(var(--surface-container-lowest))',
					'container-low': 'hsl(var(--surface-container-low))',
					container: 'hsl(var(--surface-container))',
					'container-high': 'hsl(var(--surface-container-high))',
					'container-highest': 'hsl(var(--surface-container-highest))',
				},
				'on-surface': 'hsl(var(--on-surface))',
				'on-surface-variant': 'hsl(var(--on-surface-variant))',
				'on-primary-container': 'hsl(var(--on-primary-container))',
				'on-secondary-container': 'hsl(var(--on-secondary-container))',
				'on-tertiary-container': 'hsl(var(--on-tertiary-container))',
				outline: {
					DEFAULT: 'hsl(var(--outline))',
					variant: 'hsl(var(--outline-variant))',
				},
				tertiary: {
					container: 'hsl(var(--tertiary-container))',
				},
			},
			backgroundImage: {
				'gradient-primary': 'var(--gradient-primary)',
				'gradient-secondary': 'var(--gradient-secondary)',
				'gradient-hero': 'var(--gradient-hero)'
			},
			boxShadow: {
				'primary': 'var(--shadow-primary)',
				'glow': 'var(--shadow-glow)',
				'card': '0px 20px 40px rgba(56,56,51,0.04)',
				'nav': '0px -10px 40px rgba(56,56,51,0.04)',
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)',
				xl: '1.5rem',
				'2xl': '2rem',
				'3xl': '3rem',
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
