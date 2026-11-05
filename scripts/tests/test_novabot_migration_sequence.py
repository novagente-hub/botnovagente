"""Prevent a second 0070 collision between Conexoes and tenant resources."""
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
MIGRATIONS = ROOT / "server" / "drizzle"
META = MIGRATIONS / "meta"


class NovabotMigrationSequence(unittest.TestCase):
    def test_no_duplicate_migration_numbers(self):
        files = [p for p in MIGRATIONS.glob("[0-9][0-9][0-9][0-9]_*.sql")]
        names = [p.name[:4] for p in files]
        self.assertEqual(len(names), len(set(names)))

    def test_snapshots_have_valid_chain_and_both_features(self):
        prior = json.loads((META / "0069_snapshot.json").read_text())
        conexoes = json.loads((META / "0070_snapshot.json").read_text())
        shared = json.loads((META / "0071_snapshot.json").read_text())
        self.assertEqual(prior["id"], conexoes["prevId"])
        self.assertEqual(conexoes["id"], shared["prevId"])
        self.assertEqual(len({prior["id"], conexoes["id"], shared["id"]}), 3)
        self.assertTrue(set(prior["tables"]).issubset(conexoes["tables"]))
        self.assertTrue(set(conexoes["tables"]).issubset(shared["tables"]))
        for table in (
            "public.novagente_applications",
            "public.novagente_application_grants",
            "public.novabot_shared_resources",
            "public.novabot_shared_resource_grants",
        ):
            self.assertIn(table, shared["tables"])
        for table in conexoes["tables"]:
            self.assertEqual(conexoes["tables"][table], shared["tables"][table])

    def test_journal_has_one_ordered_entry_for_each_migration(self):
        entries = json.loads((META / "_journal.json").read_text())["entries"]
        last = entries[-3:]
        self.assertEqual([e["idx"] for e in last], [69, 70, 71])
        self.assertEqual(
            [e["tag"] for e in last],
            ["0069_isolated_bots", "0070_novagente_conexoes", "0071_novabot_shared_resources"],
        )
        self.assertEqual(sorted(e["when"] for e in entries), [e["when"] for e in entries])
        for row in last:
            self.assertTrue((MIGRATIONS / (row["tag"] + ".sql")).exists())

    def test_resources_migration_is_split_for_drizzle(self):
        sql = (MIGRATIONS / "0071_novabot_shared_resources.sql").read_text()
        self.assertEqual(sql.count("CREATE TABLE"), 2)
        self.assertEqual(sql.count("CREATE INDEX"), 2)
        self.assertEqual(sql.count("--> statement-breakpoint"), 3)

    def test_schema_registration_includes_both_modules(self):
        config = (ROOT / "server" / "drizzle.config.ts").read_text()
        index = (ROOT / "server" / "src" / "db" / "schema" / "index.ts").read_text()
        for module in ("novagente-conexoes", "novabot-resources"):
            self.assertIn(module, config)
            self.assertIn(module, index)


if __name__ == "__main__":
    unittest.main()
