sample_dir := justfile_directory() / "sample_data"
shipyard := "uvx --from 'git+https://github.com/chris-peterson/shipyard@v2' shipyard"

install:
    npm install

install-cli:
    ./bin/moor install-cli

# Writes into the tree; `git restore .` throws the result away.
# Run the generators the way CI does and show what it would commit
preview-generated:
    {{shipyard}} generate
    git --no-pager diff --stat

# render the docs site
docs:
    {{shipyard}} build-docs

# preview the docs site locally
docs-preview: docs
    npx docsify-cli serve docs --open

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

# Launch with a sample REVIEW_CONTEXT so the redesigned inputs header (location
# eyebrow, commit-briefing headline, expandable details panel) has data to
# render. The fixture is copied to /tmp so the committed sample stays free of
# review output.
diff-context: sample-data build
    cp {{sample_dir}}/sample-context.json /tmp/moor-sample-context.json
    REVIEW_CONTEXT=/tmp/moor-sample-context.json ./bin/moor {{sample_dir}}/left.js {{sample_dir}}/right.js

gitconfig_repo := home_directory() / "src/github/chris-peterson/gitconfig"

git-install: build
    git config --global diff.tool moor
    git config --global difftool.moor.cmd '{{justfile_directory()}}/bin/moor "$LOCAL" "$REMOTE"'

git-uninstall:
    git config --global --remove-section difftool.moor 2>/dev/null || true
    cd {{gitconfig_repo}} && bash update.sh
