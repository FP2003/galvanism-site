-- The Resilience rule changed from +1 to +2 max HP per point. Current HP is
-- stored, while the Resilience max bonus is computed at read time, so move
-- current HP by the same +1-per-point delta to preserve existing damage.
UPDATE "characters"
SET
  "hp_current" = "hp_current" + GREATEST("stat_resilience", 0),
  "updated_at" = NOW()
WHERE "stat_resilience" > 0;
