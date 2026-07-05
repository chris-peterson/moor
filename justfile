sample_dir := justfile_directory() / "sample_data"

install:
    npm install

install-cli:
    ./bin/moor install-cli

docs:
    cp SPEC.md docs/SPEC.md
    mkdir -p docs/rules && cp rules/*.md docs/rules/
    python3 scripts/gen-suite-json.py
    docsify serve docs --open

# regenerate .claude-plugin/plugin.json from plugin.yml (the canonical descriptor)
plugin-json:
    python3 scripts/gen-plugin-json.py

# verify plugin.json is in sync with plugin.yml (used by CI and the pre-commit hook)
plugin-json-check:
    python3 scripts/gen-plugin-json.py --check

# install the git pre-commit hook that keeps plugin.json in sync with plugin.yml
install-hooks:
    cp scripts/hooks/pre-commit .git/hooks/pre-commit
    chmod +x .git/hooks/pre-commit
    @echo "installed .git/hooks/pre-commit"

build:
    ./node_modules/.bin/vite build

test:
    npm test

sample-data:
    bash scripts/create-sample-data.sh

diff: sample-data build
    ./bin/moor {{sample_dir}}/left.js {{sample_dir}}/right.js

dir-diff: sample-data build
    ./bin/moor {{sample_dir}}/left {{sample_dir}}/right

# Launch with a sample MOOR_CONTEXT so the redesigned inputs header (location
# eyebrow, commit-briefing headline, expandable details panel) has data to
# render. The fixture is copied to /tmp so the committed sample stays free of
# review output.
diff-context: sample-data build
    cp {{sample_dir}}/sample-context.json /tmp/moor-sample-context.json
    MOOR_CONTEXT=/tmp/moor-sample-context.json ./bin/moor {{sample_dir}}/left.js {{sample_dir}}/right.js

gitconfig_repo := home_directory() / "src/getty/cpeterson/gitconfig"

git-install: build
    git config --global diff.tool moor
    git config --global difftool.moor.cmd '{{justfile_directory()}}/bin/moor "$LOCAL" "$REMOTE"'

git-uninstall:
    git config --global --remove-section difftool.moor 2>/dev/null || true
    cd {{gitconfig_repo}} && bash update.sh
