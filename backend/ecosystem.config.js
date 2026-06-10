module.exports = {
    apps: [
        {
            name:               "zx-crm-backend",
            script:             "src/server.js",
            instances:          1,
            autorestart:        true,
            watch:              false,
            max_memory_restart: "512M",
            error_file:         "/var/log/zx-crm/error.log",
            out_file:           "/var/log/zx-crm/out.log",
            log_date_format:    "YYYY-MM-DD HH:mm:ss Z",
            env: {
                NODE_ENV: "production",
            },
        },
    ],
};
