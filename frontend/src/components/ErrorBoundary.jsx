import { Component } from "react";
import { AlertCircle } from "lucide-react";

export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        console.error("[ErrorBoundary]", error, info.componentStack);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-8">
                    <AlertCircle className="h-12 w-12 text-red-400" />
                    <div>
                        <p className="text-lg font-semibold text-gray-800">Something went wrong</p>
                        <p className="text-sm text-gray-500 mt-1">{this.state.error?.message || "An unexpected error occurred"}</p>
                    </div>
                    <button
                        onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
                        className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        Reload page
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
