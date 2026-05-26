sample_dir := justfile_directory() / "sample_data"

install:
    npm install

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

gitconfig_repo := home_directory() / "src/getty/cpeterson/gitconfig"

git-install: build
    git config --global diff.tool moor
    git config --global difftool.moor.cmd '{{justfile_directory()}}/bin/moor "$LOCAL" "$REMOTE"'

git-uninstall:
    git config --global --remove-section difftool.moor 2>/dev/null || true
    cd {{gitconfig_repo}} && bash update.sh
