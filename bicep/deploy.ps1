
az group create --name 'rg-caldova-super' --location 'eastus2'

az deployment group create --name 'caldova-super-deploy' --resource-group 'rg-caldova-super' --template-file './main.bicep' --parameters './main.bicepparam'
