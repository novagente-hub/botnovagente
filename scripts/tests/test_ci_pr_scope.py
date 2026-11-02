import importlib.util
import pathlib
import sys
import unittest

MODULE = pathlib.Path(__file__).resolve().parents[1] / "ci-pr-scope.py"
spec = importlib.util.spec_from_file_location("ci_pr_scope", MODULE)
scope = importlib.util.module_from_spec(spec)
sys.modules["ci_pr_scope"] = scope
spec.loader.exec_module(scope)


class PRScopeTests(unittest.TestCase):
    def assertChecks(self, paths, expected):
        self.assertEqual(scope.checks_for_paths(paths), frozenset(expected))

    def test_docs_only_needs_no_paid_build_jobs(self):
        self.assertChecks(["docs/guide.md", "README.md"], [])

    def test_app_change_keeps_types_tests_and_build(self):
        self.assertChecks(
            ["app/src/routes/_authed/index.tsx"],
            ["static", "test", "build"],
        )

    def test_computer_changes_keep_real_browser_isolation_checks(self):
        self.assertChecks(
            ["agent-computer/src/person-browser.ts"],
            ["static", "deployables", "test", "build", "computer-browser"],
        )

    def test_security_sensitive_server_change_includes_browser(self):
        self.assertChecks(
            ["server/src/auth/guards.ts"],
            ["static", "test", "build", "computer-browser"],
        )

    def test_schema_change_requires_migration_check(self):
        self.assertChecks(
            ["server/src/db/schema/core.ts"],
            ["static", "test", "build", "migrations"],
        )

    def test_chart_change_only_checks_chart_and_static(self):
        self.assertChecks(["charts/openbot/templates/config.yaml"], ["static", "chart"])

    def test_mobile_change_runs_mobile_and_static(self):
        self.assertChecks(["mobile/src/App.tsx"], ["static", "mobile"])

    def test_python_harness_deps_run_python_tests(self):
        self.assertChecks(
            ["agent-crewai/requirements.txt"],
            ["static", "test", "build", "python-harness"],
        )

    def test_unknown_agent_executable_fails_closed_to_all(self):
        for path in [
            "agent-mastra/src/provider.ts",
            "agent-bot/package.json",
            "agent-antigravity/src/run.ts",
            "agent-langgraph/src/index.ts",
        ]:
            with self.subTest(path=path):
                self.assertEqual(scope.checks_for_paths([path]), scope.ALL)

    def test_build_cache_windows_and_mac_remain_covered(self):
        self.assertChecks(
            ["app/tests/build-cache.test.ts"],
            ["static", "test", "build", "startup"],
        )

    def test_workflow_and_scope_updates_force_all(self):
        for path in [
            ".github/workflows/ci.yml",
            "scripts/ci-pr-scope.py",
            "scripts/tests/test_ci_pr_scope.py",
            "shared/model-providers.json",
            "bun.lock",
            "package.json",
            ".unexpected/config",
        ]:
            with self.subTest(path=path):
                self.assertEqual(scope.checks_for_paths([path]), scope.ALL)

    def test_mixed_docs_and_code_selects_code_checks(self):
        self.assertChecks(["docs/guide.md", "app/src/App.tsx"], ["static", "test", "build"])

    def test_deletes_and_renames_must_be_visible_to_scope(self):
        from unittest.mock import patch
        fake_base = "a" * 40
        fake_head = "b" * 40
        import subprocess
        with patch.object(scope.subprocess, "run", return_value=subprocess.CompletedProcess(
            args=[], returncode=0,
            stdout="scripts/ci-pr-scope.py\\ndocs/renamed.md\\n",
            stderr="",
        )) as run:
            paths = scope.changed_paths(fake_base, fake_head)
        args = run.call_args.args[0]
        self.assertIn("--no-renames", args)
        self.assertIn("--diff-filter=ACDMRT", args)
        self.assertEqual(scope.checks_for_paths(paths), scope.ALL)

    def test_invalid_git_revision_fails_closed(self):
        with self.assertRaises(ValueError):
            scope.changed_paths("main", "b" * 40)

    def test_no_changes_fails_closed(self):
        self.assertEqual(scope.checks_for_paths([]), scope.ALL)


if __name__ == "__main__":
    unittest.main()
