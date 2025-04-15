{
  config,
  lib,
  pkgs,
  ...
}: let
  cfg = config.services.versia-server;
  configFormat = pkgs.formats.toml {};
  name = "versia-server";

  inherit (lib.options) mkOption;
  inherit (lib.modules) mkIf;
in {
  options = {
    services.versia-server = {
      enable = mkOption {
        type = lib.types.bool;
        default = false;
        description = ''
          Enable the Versia Server services.
        '';
      };

      dataDir = mkOption {
        type = lib.types.path;
        default = "/var/lib/${name}";
        description = ''
          Directory where the server will store its data.
        '';
      };

      user = mkOption {
        type = lib.types.str;
        default = name;
        description = ''
          User under which the server will run.
        '';
      };

      group = mkOption {
        type = lib.types.str;
        default = name;
        description = ''
          Group under which the server will run.
        '';
      };

      nodes = {
        api = mkOption {
          type = lib.types.attrsOf lib.types.submodule {
            options = {
              configOverrides = mkOption {
                type = lib.types.submodule {
                  freeformType = configFormat.type;
                  options = {};
                };
                description = "Overrides for the node's configuration file.";
              };
            };
          };
        };
        worker = mkOption {
          type = lib.types.attrsOf lib.types.submodule {
            options = {
              configOverrides = mkOption {
                type = lib.types.submodule {
                  freeformType = configFormat.type;
                  options = {};
                };
                description = "Overrides for the node's configuration file.";
              };
            };
          };
        };
      };

      config = mkOption {
        type = lib.types.submodule {
          freeformType = configFormat.type;
          options = {};
        };
        description = "Contents of the config file, which is serialized to TOML. Check the Versia Server documentation for information on its contents.";
      };
    };
  };

  config = mkIf cfg.enable {
    assertions = [
      {
        assertion = cfg.nodes.api != [];
        message = "At least one API node must be defined.";
      }
      {
        assertion = cfg.nodes.worker != [];
        message = "At least one worker node must be defined.";
      }
    ];

    systemd.services =
      builtins.mapAttrs (nodeName: node: let
        config = cfg.config // node.configOverrides;
        configFile = builtins.toFile (configFormat.generate "config-${nodeName}" config);
      in {
        after = ["network-online.target"];
        wantedBy = ["multi-user.target"];
        requires = ["network-online.target"];

        serviceConfig = {
          Type = "simple";
          Restart = "always";

          User = cfg.user;
          Group = cfg.group;

          StateDirectory = "${name}";
          StateDirectoryMode = "0700";
          RuntimeDirectory = "${name}";
          RuntimeDirectoryMode = "0700";

          # Set the working directory to the data directory
          WorkingDirectory = cfg.dataDir;

          StandardOutput = "journal";
          StandardError = "journal";
          SyslogIdentifier = "${name}";

          Environment = [
            "CONFIG_FILE=${configFile}"
          ];
        };
        path = [pkgs.versia-server];
      }) (cfg.nodes.api ++ cfg.nodes.worker)
      // builtins.mapAttrs (nodeName: node: let
        type = "api";
        exe = lib.getExe pkgs.versia-server;
      in {
        name = "${name}-${type}-${nodeName}";
        description = "Versia Server ${node.name} (${type})";

        serviceConfig.ExecStart = "${exe}";
      }) (cfg.nodes.api)
      // builtins.mapAttrs (nodeName: node: let
        type = "worker";
        exe = lib.getExe pkgs.versia-server-worker;
      in {
        name = "${name}-${type}-${nodeName}";
        description = "Versia Server ${node.name} (${type})";

        serviceConfig.ExecStart = "${exe}";
      }) (cfg.nodes.worker);

    systemd.tmpfiles.rules = [
      {
        # Create the data directory with the correct permissions
        line = "d ${cfg.dataDir} - - - - ${cfg.user} ${cfg.group}";
      }
    ];

    users = {
      groups = {
        "${cfg.group}" = {
          description = "Group for the Versia Server";
        };
      };

      users = {
        "${cfg.user}" = {
          isSystemUser = true;
          group = cfg.group;
          home = cfg.dataDir;
          packages = [pkgs.versia-server pkgs.versia-server-worker];
        };
      };
    };
  };
}
