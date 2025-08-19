import { Helmet } from 'react-helmet-async';
import BaSyxAssetsWidget from '@/components/basyx/BaSyxAssetsWidget';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Database, 
  ExternalLink, 
  Info,
  Settings,
  Layers
} from 'lucide-react';

export function BaSyxAssetsPage() {
  return (
    <>
      <Helmet>
        <title>BaSyx Assets - IIOT Platform</title>
        <meta name="description" content="Manage and monitor BaSyx Asset Administration Shells" />
      </Helmet>

      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">BaSyx Asset Administration Shells</h1>
            <p className="text-gray-600 mt-1">
              Monitor and manage your Industry 4.0 digital twins through Eclipse BaSyx
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button 
              onClick={() => window.open('http://localhost:8080', '_blank')} 
              variant="outline"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Open BaSyx UI
            </Button>
            <Button 
              onClick={() => window.open('http://localhost:8082/shell-descriptors', '_blank')} 
              variant="outline"
            >
              <Database className="w-4 h-4 mr-2" />
              Registry API
            </Button>
          </div>
        </div>

        {/* Information Card */}
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-blue-800">
              <Info className="w-5 h-5" />
              <span>About BaSyx Integration</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-blue-700">
            <div className="space-y-2">
              <p>
                Eclipse BaSyx is an open-source platform for Industry 4.0 that implements the 
                Asset Administration Shell (AAS) standard. This integration allows you to:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Monitor digital twins of your industrial assets</li>
                <li>Access real-time sensor data through standardized interfaces</li>
                <li>Manage asset metadata and properties</li>
                <li>Integrate with existing IIOT infrastructure</li>
              </ul>
              <div className="flex items-center space-x-4 mt-4">
                <Badge variant="outline" className="bg-white">
                  <Settings className="w-3 h-3 mr-1" />
                  AAS Environment: :8081
                </Badge>
                <Badge variant="outline" className="bg-white">
                  <Database className="w-3 h-3 mr-1" />
                  AAS Registry: :8082
                </Badge>
                <Badge variant="outline" className="bg-white">
                  <Layers className="w-3 h-3 mr-1" />
                  Submodel Registry: :8083
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* BaSyx Assets Widget */}
        <BaSyxAssetsWidget />

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button 
                variant="outline" 
                className="h-auto p-4 flex flex-col items-center space-y-2"
                onClick={() => window.open('http://localhost:8080', '_blank')}
              >
                <ExternalLink className="w-8 h-8" />
                <div className="text-center">
                  <div className="font-semibold">BaSyx AAS-UI</div>
                  <div className="text-sm text-gray-500">Web interface for asset management</div>
                </div>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-auto p-4 flex flex-col items-center space-y-2"
                onClick={() => window.open('http://localhost:8081/shells', '_blank')}
              >
                <Database className="w-8 h-8" />
                <div className="text-center">
                  <div className="font-semibold">AAS Environment API</div>
                  <div className="text-sm text-gray-500">Direct API access to assets</div>
                </div>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-auto p-4 flex flex-col items-center space-y-2"
                onClick={() => window.open('http://localhost:8082/shell-descriptors', '_blank')}
              >
                <Settings className="w-8 h-8" />
                <div className="text-center">
                  <div className="font-semibold">Registry API</div>
                  <div className="text-sm text-gray-500">Asset registry and discovery</div>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default BaSyxAssetsPage;