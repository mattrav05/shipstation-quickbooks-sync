# ShipStation to QuickBooks IIF Generator

A web-based tool that pulls shipment data from ShipStation and generates IIF files for QuickBooks Desktop inventory adjustment.

## Features

- Pulls shipped orders from ShipStation for specified date ranges
- Consolidates SKUs across all sales channels
- Automatically matches ShipStation SKUs to QuickBooks items (with subitem prefixes)
- Filters out dropship items that don't exist in QuickBooks
- Generates properly formatted IIF files for QuickBooks Desktop import
- Web-based interface - no installation required

## Deployment to Vercel

### Option 1: Deploy via GitHub

1. Create a GitHub repository and push this code
2. Sign up for a free Vercel account at [vercel.com](https://vercel.com)
3. Click "Import Project" and connect your GitHub repository
4. Add environment variables in Vercel dashboard:
   - `SHIPSTATION_API_KEY`
   - `SHIPSTATION_API_SECRET`
5. Deploy!

### Option 2: Direct Upload

1. Sign up for Vercel at [vercel.com](https://vercel.com)
2. Install Vercel CLI: `npm i -g vercel`
3. Run `vercel` in this directory
4. Follow the prompts to deploy

### Option 3: Deploy Button

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/shipstation-quickbooks-sync)

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env` file with your credentials:
   ```
   SHIPSTATION_API_KEY=your_api_key
   SHIPSTATION_API_SECRET=your_api_secret
   ```

3. Run development server:
   ```bash
   npm run dev
   ```

4. Open http://localhost:3000

## Usage

1. **Setup QuickBooks SKUs**:
   - Paste your QuickBooks item list in the first text area
   - Click "Build SKU Lookup Table"
   - The system automatically handles subitem prefixes (e.g., `-USMICH-:USM1020`)

2. **Select Date Range**:
   - Use preset buttons (Yesterday, Last 7 Days, Last 30 Days)
   - Or select custom dates

3. **Generate IIF File**:
   - Click "Pull Data & Generate IIF"
   - Review the statistics and preview
   - Download the IIF file

4. **Import to QuickBooks**:
   - Open QuickBooks Desktop
   - Go to File → Utilities → Import → IIF Files
   - Select the downloaded file
   - Review and post the inventory adjustments

## IIF File Format

The generated IIF file creates inventory adjustment transactions that:
- Reduce inventory quantities based on shipped orders
- Include proper QuickBooks item codes with subitem prefixes
- Add memo fields with date ranges for tracking
- Use negative quantities to relieve inventory

## Security Notes

- Never commit API credentials to your repository
- Use Vercel's environment variables for production
- The `.env` file is gitignored for security

## Support

For issues or questions, please contact your system administrator.