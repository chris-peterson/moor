sample_dir := justfile_directory() / "sample_data"

install:
    npm install

install-cli:
    ./bin/moor install-cli

docs:
    cp SPEC.md docs/SPEC.md
    mkdir -p docs/rules && cp rules/*.md docs/rules/
    docsify serve docs --open

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

# Launch with a sample MOOR_CONTEXT so the redesigned inputs header (Location /
# Context, details panel, [prev] read-only preview) has data to render. The
# fixture is copied to /tmp so the committed sample stays free of review output.
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
