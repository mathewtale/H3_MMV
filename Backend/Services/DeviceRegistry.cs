
    namespace Backend.Services;

    public class DeviceRegistry
    {
        private string? _lastSeenDeviceId;

        public void Register(string deviceId)
        {
            Interlocked.Exchange(ref _lastSeenDeviceId, deviceId);
        }

        public string? LastSeenDeviceId =>
            Volatile.Read(ref _lastSeenDeviceId);
    }