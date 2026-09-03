import platform
import sys

def main() -> None:
    print("=" * 56)
    print("PyTorch Hardware Diagnostic")
    print("=" * 56)
    print(f"Python Version:  {sys.version.split()[0]} ({platform.python_implementation()})")
    try:
        import torch
    except Exception as error:
        print("PyTorch Version: Not available")
        print("CUDA Available:  False")
        print("GPU Device Name: Not detected (running on CPU)")
        print(f"PyTorch Import Error: {error}")
        print("=" * 56)
        return

    print(f"PyTorch Version: {torch.__version__}")

    cuda_available = torch.cuda.is_available()
    print(f"CUDA Available:  {cuda_available}")

    if cuda_available and torch.cuda.device_count() > 0:
        device_name = torch.cuda.get_device_name(0)
        print(f"GPU Device Name: {device_name}")
    else:
        print("GPU Device Name: Not detected (running on CPU)")

    print("=" * 56)


if __name__ == "__main__":
    main()
