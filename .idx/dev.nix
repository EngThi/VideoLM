# To learn more about how to use Nix to configure your environment
# see: https://developers.google.com/idx/guides/customize-idx-env
{ pkgs, ... }: {
  # Which nixpkgs channel to use.
  channel = "stable-24.05"; # or "unstable"

  # Use https://search.nixos.org/packages to find packages
  packages = [
    pkgs.nodejs_20
    pkgs.python3
    pkgs.ffmpeg
    pkgs.docker-compose
    pkgs.openssh
  ];

  # Enable the Docker daemon
  services.docker.enable = true;

  # Sets environment variables in the workspace
  env = {};
  idx = {
    # Search for the extensions you want on https://open-vsx.org/ and use "publisher.id"
    extensions = [
      # "vscodevim.vim"
    ];
    
    # Workspace lifecycle hooks
    workspace = {
      # Runs when a workspace is first created
      onCreate = {
        npm-install = "npm ci && npm run server:install";
      };
      # Runs when the workspace is (re)started
      onStart = {
        # Don't auto-run dev server on start to avoid port conflicts during rebuilds
        # User will start it manually or let the preview handle it
      };
    };

    # Enable previews
    previews = {
      enable = true;
      previews = {
        # The web preview configuration
        web = {
          # Command to run the dev server.
          command = ["npm" "run" "dev"];
          manager = "web";
          env = {
            # Use the port assigned by IDX
            PORT = "$PORT";
            HMR_PORT = "$PORT";
          };
        };
      };
    };
  };
}
