using UnityEngine;

namespace AquariumDemo
{
    /// <summary>
    /// Provides a gentle orbiting motion around the aquarium with optional sway.
    /// Attach to a pivot GameObject and assign the target camera.
    /// </summary>
    public class CameraOrbit : MonoBehaviour
    {
        [SerializeField] private Transform cameraTransform = null;
        [SerializeField, Range(0.1f, 20f)] private float orbitSpeed = 10f;
        [SerializeField, Range(0.1f, 10f)] private float distance = 4f;
        [SerializeField] private Vector2 verticalSway = new Vector2(0.2f, 0.1f);
        [SerializeField, Range(-2f, 2f)] private float heightOffset = 0.5f;
        [SerializeField] private bool autoAlignOnStart = true;

        private float _orbitAngle;
        private Vector3 _focusPoint;

        private void Start()
        {
            if (cameraTransform == null && Camera.main != null)
            {
                cameraTransform = Camera.main.transform;
            }

            _focusPoint = transform.position;

            if (autoAlignOnStart && cameraTransform != null)
            {
                Vector3 offset = cameraTransform.position - _focusPoint;
                offset.y = 0f;
                _orbitAngle = Mathf.Atan2(offset.x, offset.z) * Mathf.Rad2Deg;
            }
        }

        private void LateUpdate()
        {
            if (cameraTransform == null)
            {
                return;
            }

            _orbitAngle += orbitSpeed * Time.deltaTime;
            float rad = _orbitAngle * Mathf.Deg2Rad;

            float swayHeight = Mathf.Sin(Time.time * verticalSway.y) * verticalSway.x;
            Vector3 desiredPosition = new Vector3(
                _focusPoint.x + Mathf.Sin(rad) * distance,
                _focusPoint.y + heightOffset + swayHeight,
                _focusPoint.z + Mathf.Cos(rad) * distance
            );

            cameraTransform.position = Vector3.Lerp(cameraTransform.position, desiredPosition, Time.deltaTime * 0.5f);
            cameraTransform.LookAt(_focusPoint);
        }
    }
}
