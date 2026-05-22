# Contributing to SecureDoc Copilot

First off, thank you for considering contributing to SecureDoc Copilot! It's people like you that make open-source such a fantastic community to learn, inspire, and create.

## Where do I go from here?

If you've noticed a bug or have a feature request, make sure to check our [Issues](https://github.com/Techie03/securedoc-copilot/issues) first to see if someone else has already created a ticket. If not, go ahead and [make one](https://github.com/Techie03/securedoc-copilot/issues/new/choose)!

## Fork & create a branch

If this is something you think you can fix, then fork SecureDoc Copilot and create a branch with a descriptive name.

```bash
git checkout -b feature/my-awesome-feature
```

## Setup the environment

1. Make sure you have Docker, Python 3.10+, and Node.js 20+ installed.
2. Run `npm install` inside the `apps/web` folder.
3. Create a python virtual environment and run `pip install -r requirements.txt` inside the `apps/api` folder.
4. Copy `.env.example` to `.env` and configure your local keys.

## Implement your fix or feature

At this point, you're ready to make your changes! Feel free to ask for help; everyone is a beginner at first.

## Make a Pull Request

At this point, you should switch back to your master branch and make sure it's up to date with SecureDoc Copilot's master branch:

```bash
git remote add upstream https://github.com/Techie03/securedoc-copilot.git
git checkout main
git pull upstream main
```

Then update your feature branch from your local copy of main, and push it!

```bash
git checkout feature/my-awesome-feature
git rebase main
git push --set-upstream origin feature/my-awesome-feature
```

Finally, go to GitHub and [make a Pull Request](https://github.com/Techie03/securedoc-copilot/compare) with a clear list of what you've done (read more about [pull requests](https://help.github.com/articles/about-pull-requests/)).

## Code of Conduct

Please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms. We expect all contributors to be respectful and constructive.
