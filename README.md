# vulpes-blockbench

A Blockbench desktop plugin that lets designers open and save `.bbmodel` files
directly from and to Vulpes, the content management system for Minecraft server
content. Designers stay in Blockbench: they sign in once, pick a project and a
model from Vulpes, and save changes back with Ctrl+S.

The plugin targets the Blockbench desktop app (Electron) only. The web version of
Blockbench is not supported, because the plugin relies on the local system browser
for sign-in and on the desktop file system and network stack.

Status: **in design**. The OpenSpec changes under `openspec/changes/` describe the
planned behaviour. No plugin code exists yet.
