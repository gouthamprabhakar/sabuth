CREATE TABLE `team_login_limits` (
	`username` text PRIMARY KEY NOT NULL,
	`attempts` integer NOT NULL,
	`window_start` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `team_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`credential_version` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_team_sessions_expiry` ON `team_sessions` (`expires_at`);