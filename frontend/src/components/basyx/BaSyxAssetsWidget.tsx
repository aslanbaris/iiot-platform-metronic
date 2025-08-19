import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/supabase';
import { 
  Database, 
  Settings, 
  Activity, 
  AlertCircle, 
  CheckCircle, 
  RefreshCw,
  ExternalLink,
  Layers
} from 'lucide-react';

interface AASInfo {
  id: string;
  idShort: string;
  displayName?: string;
  description?: string;
  assetInformation?: {
    assetKind: string;
    globalAssetId: string;
  };
  submodels?: Array<{
    keys: Array<{
      type: string;
      value: string;
    }>;
  }>;
}

interface SubmodelElement {
  idShort: string;
  modelType: string;
  value?: any;
  valueType?: string;
  description?: string;
}

interface SubmodelInfo {
  id: string;
  idShort: string;
  description?: string;
  submodelElements?: SubmodelElement[];
}

interface BaSyxHealthStatus {
  aasEnvironment: 'healthy' | 'unhealthy' | 'unknown';
  aasRegistry: 'healthy' | 'unhealthy' | 'unknown';
  submodelRegistry: 'healthy' | 'unhealthy' | 'unknown';
  discovery: 'healthy' | 'unhealthy' | 'unknown';
}

export function BaSyxAssetsWidget() {
  const [assets, setAssets] = useState<AASInfo[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<AASInfo | null>(null);
  const [submodels, setSubmodels] = useState<SubmodelInfo[]>([]);
  const [healthStatus, setHealthStatus] = useState<BaSyxHealthStatus>({
    aasEnvironment: 'unknown',
    aasRegistry: 'unknown',
    submodelRegistry: 'unknown',
    discovery: 'unknown'
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch BaSyx health status
  const fetchHealthStatus = async () => {
    try {
      const response = await apiClient.get('/basyx/health');
      setHealthStatus(response.data.services || response.data);
    } catch (err: any) {
      console.error('Failed to fetch BaSyx health status:', err);
    }
  };

  // Fetch all AAS assets
  const fetchAssets = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/basyx/aas');
      setAssets(response.data.aas || response.data.result || []);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch BaSyx assets:', err);
      setError('Failed to load BaSyx assets. Please check if BaSyx services are running.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch submodels for selected asset
  const fetchSubmodels = async (assetId: string) => {
    try {
      const response = await apiClient.get(`/basyx/aas/${encodeURIComponent(assetId)}/submodels`);
      setSubmodels(response.data.result || []);
    } catch (err: any) {
      console.error('Failed to fetch submodels:', err);
    }
  };

  // Refresh all data
  const refreshData = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchHealthStatus(),
      fetchAssets()
    ]);
    setRefreshing(false);
  };

  // Initial data load
  useEffect(() => {
    refreshData();
  }, []);

  // Load submodels when asset is selected
  useEffect(() => {
    if (selectedAsset) {
      fetchSubmodels(selectedAsset.id);
    }
  }, [selectedAsset]);

  const getHealthBadgeVariant = (status: string) => {
    switch (status) {
      case 'healthy': return 'default';
      case 'unhealthy': return 'destructive';
      default: return 'secondary';
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-3 h-3" />;
      case 'unhealthy': return <AlertCircle className="w-3 h-3" />;
      default: return <Activity className="w-3 h-3" />;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Database className="w-5 h-5" />
            <span>BaSyx Assets</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">Loading BaSyx assets...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* BaSyx Services Health Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Settings className="w-5 h-5" />
              <span>BaSyx Services Status</span>
            </div>
            <Button 
              onClick={refreshData} 
              variant="outline" 
              size="sm" 
              disabled={refreshing}
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <Badge variant={getHealthBadgeVariant(healthStatus.aasEnvironment)} className="mb-1">
                {getHealthIcon(healthStatus.aasEnvironment)}
                <span className="ml-1">AAS Environment</span>
              </Badge>
              <p className="text-xs text-gray-500">:8081</p>
            </div>
            <div className="text-center">
              <Badge variant={getHealthBadgeVariant(healthStatus.aasRegistry)} className="mb-1">
                {getHealthIcon(healthStatus.aasRegistry)}
                <span className="ml-1">AAS Registry</span>
              </Badge>
              <p className="text-xs text-gray-500">:8082</p>
            </div>
            <div className="text-center">
              <Badge variant={getHealthBadgeVariant(healthStatus.submodelRegistry)} className="mb-1">
                {getHealthIcon(healthStatus.submodelRegistry)}
                <span className="ml-1">SM Registry</span>
              </Badge>
              <p className="text-xs text-gray-500">:8083</p>
            </div>
            <div className="text-center">
              <Badge variant={getHealthBadgeVariant(healthStatus.discovery)} className="mb-1">
                {getHealthIcon(healthStatus.discovery)}
                <span className="ml-1">Discovery</span>
              </Badge>
              <p className="text-xs text-gray-500">:8084</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* BaSyx Assets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Database className="w-5 h-5" />
              <span>Asset Administration Shells</span>
              <Badge variant="outline">{assets.length}</Badge>
            </div>
            <Button 
              onClick={() => window.open('http://localhost:8080', '_blank')} 
              variant="outline" 
              size="sm"
            >
              <ExternalLink className="w-4 h-4 mr-1" />
              Open BaSyx UI
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-center space-x-2 text-red-700">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">{error}</span>
              </div>
            </div>
          )}

          {assets.length > 0 ? (
            <div className="space-y-4">
              {assets.map((asset) => (
                <div 
                  key={asset.id} 
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    selectedAsset?.id === asset.id 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedAsset(asset)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-lg">{asset.idShort}</h4>
                      {asset.displayName && (
                        <p className="text-sm text-gray-600 mt-1">{asset.displayName}</p>
                      )}
                      {asset.description && (
                        <p className="text-xs text-gray-500 mt-1">{asset.description}</p>
                      )}
                      <div className="mt-2 space-y-1">
                        <p className="text-xs text-gray-500">
                          <span className="font-medium">ID:</span> {asset.id}
                        </p>
                        {asset.assetInformation && (
                          <>
                            <p className="text-xs text-gray-500">
                              <span className="font-medium">Asset Kind:</span> {asset.assetInformation.assetKind}
                            </p>
                            <p className="text-xs text-gray-500">
                              <span className="font-medium">Global Asset ID:</span> {asset.assetInformation.globalAssetId}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">
                        <Layers className="w-3 h-3 mr-1" />
                        {asset.submodels?.length || 0} Submodels
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Database className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No Asset Administration Shells found.</p>
              <p className="text-sm mt-1">Make sure BaSyx services are running and assets are registered.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected Asset Submodels */}
      {selectedAsset && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Layers className="w-5 h-5" />
              <span>Submodels for {selectedAsset.idShort}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {submodels.length > 0 ? (
              <div className="space-y-4">
                {submodels.map((submodel) => (
                  <div key={submodel.id} className="border rounded-lg p-4">
                    <h5 className="font-semibold">{submodel.idShort}</h5>
                    {submodel.description && (
                      <p className="text-sm text-gray-600 mt-1">{submodel.description}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      <span className="font-medium">ID:</span> {submodel.id}
                    </p>
                    
                    {submodel.submodelElements && submodel.submodelElements.length > 0 && (
                      <div className="mt-3">
                        <h6 className="text-sm font-medium mb-2">Elements:</h6>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {submodel.submodelElements.map((element, index) => (
                            <div key={index} className="bg-gray-50 rounded p-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">{element.idShort}</span>
                                <Badge variant="outline" className="text-xs">
                                  {element.modelType}
                                </Badge>
                              </div>
                              {element.value !== undefined && (
                                <p className="text-sm text-gray-600 mt-1">
                                  <span className="font-medium">Value:</span> {String(element.value)}
                                  {element.valueType && (
                                    <span className="text-xs text-gray-500 ml-1">({element.valueType})</span>
                                  )}
                                </p>
                              )}
                              {element.description && (
                                <p className="text-xs text-gray-500 mt-1">{element.description}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Layers className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p>No submodels found for this asset.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default BaSyxAssetsWidget;