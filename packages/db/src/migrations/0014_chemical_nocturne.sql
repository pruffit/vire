CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "artist_posts_artist_profile_id_idx" ON "artist_posts" USING btree ("artist_profile_id");--> statement-breakpoint
CREATE INDEX "artist_profiles_user_id_idx" ON "artist_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "releases_artist_profile_id_idx" ON "releases" USING btree ("artist_profile_id");--> statement-breakpoint
CREATE INDEX "tracks_release_id_idx" ON "tracks" USING btree ("release_id");--> statement-breakpoint
CREATE INDEX "track_contributors_track_id_idx" ON "track_contributors" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "favorite_moments_track_id_idx" ON "favorite_moments" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "follows_artist_profile_id_idx" ON "follows" USING btree ("artist_profile_id");--> statement-breakpoint
CREATE INDEX "likes_track_id_idx" ON "likes" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "playlist_likes_playlist_id_idx" ON "playlist_likes" USING btree ("playlist_id");--> statement-breakpoint
CREATE INDEX "playlist_tracks_playlist_id_idx" ON "playlist_tracks" USING btree ("playlist_id");--> statement-breakpoint
CREATE INDEX "playlists_owner_user_id_idx" ON "playlists" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "purchases_user_item_idx" ON "purchases" USING btree ("user_id","item_id");--> statement-breakpoint
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "play_events_track_id_idx" ON "play_events" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "play_events_started_at_idx" ON "play_events" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "play_events_user_id_idx" ON "play_events" USING btree ("user_id");