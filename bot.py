import discord
from discord.ext import commands
import aiohttp
import json
import os
import sys

# --- SECURE CONFIGURATION VIA ENVIRONMENT VARIABLES ---
# Railway will automatically inject these variables securely at runtime.
BOT_TOKEN = os.getenv("BOT_TOKEN")
MINECRAFT_API_URL = os.getenv("MINECRAFT_API_URL", "http://your-plugin-ip:8080/api/verify")
SECRET_TOKEN = os.getenv("SECRET_TOKEN")
TICKET_CATEGORY_ID = os.getenv("TICKET_CATEGORY_ID")

# Critical check to prevent the bot from running without essential variables
if not BOT_TOKEN or not SECRET_TOKEN or not TICKET_CATEGORY_ID:
    print("❌ Critical Error: Missing required environment variables (BOT_TOKEN, SECRET_TOKEN, or TICKET_CATEGORY_ID).", file=sys.stderr)
    sys.exit(1)

try:
    TICKET_CATEGORY_ID = int(TICKET_CATEGORY_ID)
except ValueError:
    print("❌ Critical Error: TICKET_CATEGORY_ID must be a valid integer numerical ID.", file=sys.stderr)
    sys.exit(1)
# ------------------------------------------------------

class VerificationModal(discord.ui.Modal, title="Minecraft Account Verification"):
    """
    An elegant pop-up modal to capture player details securely.
    """
    username = discord.ui.TextInput(
        label="Minecraft Username",
        placeholder="Enter your exact in-game name...",
        required=True,
        min_length=3,
        max_length=16
    )
    
    verify_code = discord.ui.TextInput(
        label="Verification Code",
        placeholder="Enter the code shown on the server...",
        required=True,
        min_length=4,
        max_length=8
    )

    async def on_submit(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)
        
        payload = {
            "discord_id": str(interaction.user.id),
            "username": self.username.value,
            "code": self.verify_code.value
        }
        
        headers = {
            "Authorization": f"Bearer {SECRET_TOKEN}",
            "Content-Type": "application/json"
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(MINECRAFT_API_URL, data=json.dumps(payload), headers=headers, timeout=5) as response:
                    if response.status == 200:
                        res_data = await response.json()
                        await interaction.followup.send(
                            f"✅ **Success!** {res_data.get('message', 'Account linked successfully.')}", 
                            ephemeral=True
                        )
                        await interaction.channel.edit(name=f"✅-{self.username.value}")
                    else:
                        await interaction.followup.send(
                            "❌ **Verification Failed!** Invalid code or player not found on the server.", 
                            ephemeral=True
                        )
        except Exception as e:
            await interaction.followup.send(
                f"⚠️ **Bridge Error:** Could not connect to Minecraft server backend. ({str(e)})", 
                ephemeral=True
            )

class TicketOptionsView(discord.ui.View):
    """
    Interactive buttons inside the opened ticket channel.
    """
    def __init__(self):
        super().__init__(timeout=None)

    @discord.ui.button(label="Verify Account", style=discord.ButtonStyle.green, custom_id="btn_verify_mc", emoji="🎮")
    async def verify_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.send_modal(VerificationModal())

    @discord.ui.button(label="Close Ticket", style=discord.ButtonStyle.danger, custom_id="btn_close_ticket", emoji="🔒")
    async def close_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.send_message("Closing ticket in 5 seconds...", ephemeral=False)
        await interaction.channel.delete(delay=5.0)

class CreateTicketView(discord.ui.View):
    """
    Persistent main panel button for players to create a ticket.
    """
    def __init__(self):
        super().__init__(timeout=None)

    @discord.ui.button(label="Open Verification Ticket", style=discord.ButtonStyle.blurple, custom_id="btn_open_ticket", emoji="🎟️")
    async def open_ticket(self, interaction: discord.Interaction, button: discord.ui.Button):
        guild = interaction.guild
        category = guild.get_channel(TICKET_CATEGORY_ID)
        
        if not category:
            await interaction.response.send_message("❌ Error: Ticket category not found. Please contact an admin.", ephemeral=True)
            return

        overwrites = {
            guild.default_role: discord.PermissionOverwrite(read_messages=False),
            interaction.user: discord.PermissionOverwrite(read_messages=True, send_messages=True, embed_links=True),
            guild.me: discord.PermissionOverwrite(read_messages=True, send_messages=True, manage_channels=True)
        }
        
        ticket_channel = await guild.create_text_channel(
            name=f"ticket-{interaction.user.name}",
            category=category,
            overwrites=overwrites
        )
        
        embed = discord.Embed(
            title="⚡ NetPulse Network | Verification Gate",
            description=(
                f"Welcome {interaction.user.mention},\n\n"
                "To link your Minecraft account with our platform, please follow these steps:\n"
                "1️⃣ Log into the Minecraft Server.\n"
                "2️⃣ Click the **Verify Account** button below.\n"
                "3️⃣ Input your exact username and verification code.\n\n"
                "*Need help? Our staff will assist you shortly.*"
            ),
            color=0x00ffff # Neon Cyan
        )
        embed.set_footer(text="NetPulse Automation Core • Secure Channel")
        
        await ticket_channel.send(embed=embed, view=TicketOptionsView())
        await interaction.response.send_message(f"Ticket created successfully! Go to {ticket_channel.mention}", ephemeral=True)

class TicketBot(commands.Bot):
    def __init__(self):
        intents = discord.Intents.default()
        intents.message_content = True
        super().__init__(command_prefix="!", intents=intents)

    async def setup_hook(self):
        self.add_view(CreateTicketView())
        self.add_view(TicketOptionsView())

bot = TicketBot()

@bot.event
async def on_ready():
    print(f"✨ Ticket System Bot is successfully online as {bot.user}")

@bot.command(name="setupverify")
@commands.has_permissions(administrator=True)
async def setup_verify_panel(ctx):
    """
    Command to deploy the master persistent panel in the verification channel.
    """
    embed = discord.Embed(
        title="🎮 Account Verification Hub",
        description=(
            "Click the button below to open a secure tracking ticket.\n"
            "This will allow you to sync your in-game profile data seamlessly."
        ),
        color=0xbf00ff # Neon Purple
    )
    await ctx.send(embed=embed, view=CreateTicketView())
    await ctx.message.delete()

if __name__ == "__main__":
    bot.run(BOT_TOKEN)
