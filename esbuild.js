const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const isProduction = process.argv.includes("--production");
const isWatch = process.argv.includes("--watch");

async function main() {
    fs.mkdirSync(path.join(__dirname, "dist"), { recursive: true });
    fs.mkdirSync(path.join(__dirname, "dist", "media"), { recursive: true });

    // 1. Extension bundle
    const extensionCtx = await esbuild.context({
        entryPoints: ["src/extension.ts"],
        bundle: true,
        outfile: "dist/extension.js",
        external: ["vscode"],
        format: "cjs",
        platform: "node",
        target: "node18",
        minify: isProduction,
        sourcemap: !isProduction,
        sourcesContent: false,
        logLevel: "info",
    });

    // 2. Webview JS
    const webviewJsCtx = await esbuild.context({
        entryPoints: ["media/conversation-manager.js"],
        bundle: false,
        outfile: "dist/media/conversation-manager.js",
        minify: isProduction,
        sourcemap: !isProduction,
        target: ["es2020", "chrome100"],
        logLevel: "info",
    });

    // 3. Webview CSS
    const webviewCssCtx = await esbuild.context({
        entryPoints: ["media/conversation-manager.css"],
        bundle: false,
        outfile: "dist/media/conversation-manager.css",
        minify: isProduction,
        logLevel: "info",
    });

    // 4. Copy media assets
    const copyAssets = () => {
        const mediaDir = path.join(__dirname, "media");
        if (fs.existsSync(mediaDir)) {
            const files = fs.readdirSync(mediaDir);
            for (const file of files) {
                if (file.endsWith(".svg") || file.endsWith(".png") || file.endsWith(".woff") || file.endsWith(".woff2")) {
                    const src = path.join(mediaDir, file);
                    const dest = path.join(__dirname, "dist", "media", file);
                    fs.copyFileSync(src, dest);
                }
            }
        }
    };
    copyAssets();

    if (isWatch) {
        await Promise.all([
            extensionCtx.watch(),
            webviewJsCtx.watch(),
            webviewCssCtx.watch(),
        ]);
        console.log("esbuild is watching for file changes...");
    } else {
        await Promise.all([
            extensionCtx.rebuild(),
            webviewJsCtx.rebuild(),
            webviewCssCtx.rebuild(),
        ]);
        await Promise.all([
            extensionCtx.dispose(),
            webviewJsCtx.dispose(),
            webviewCssCtx.dispose(),
        ]);
        console.log(`esbuild finished successfully (${isProduction ? "production" : "development"}).`);
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});

